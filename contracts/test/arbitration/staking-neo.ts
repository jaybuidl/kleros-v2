import { ethers, getNamedAccounts, network, deployments } from "hardhat";
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
import { BigNumber } from "ethers";
import {
  PNK,
  RandomizerRNG,
  RandomizerMock,
  SortitionModuleNeo,
  KlerosCoreNeo,
  TestERC721,
  DisputeResolver,
} from "../../typechain-types";
import { expect } from "chai";

/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */

/************************************************************************************************
Neo should behave like an arbitrator when all the following conditions are met:
- maxStake is high enough, 
- totalMaxStaked is high enough, 
- the juror has a NFT
- the arbitrable is whitelisted

Otherwise it should behave like a Neo arbitrator.
************************************************************************************************/

// TODO: assert on sortition.totalStaked in happy case

describe("Staking", async () => {
  const ETH = (amount: number) => ethers.utils.parseUnits(amount.toString());
  const PNK = ETH;

  // 2nd court, 3 jurors, 1 dispute kit
  const extraData =
    "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000001";

  let deployer;
  let juror;
  let pnk;
  let core;
  let sortition;
  let rng;
  let randomizer;
  let nft;
  let resolver;
  let balanceBefore;

  const deployUnhappy = async () => {
    ({ deployer } = await getNamedAccounts());
    await deployments.fixture(["ArbitrationNeo"], {
      fallbackToGlobal: true,
      keepExistingDeployments: false,
    });
    pnk = (await ethers.getContract("PNK")) as PNK;
    core = (await ethers.getContract("KlerosCoreNeo")) as KlerosCoreNeo;
    sortition = (await ethers.getContract("SortitionModuleNeo")) as SortitionModuleNeo;
    rng = (await ethers.getContract("RandomizerRNG")) as RandomizerRNG;
    randomizer = (await ethers.getContract("RandomizerOracle")) as RandomizerMock;
    resolver = (await ethers.getContract("DisputeResolver")) as DisputeResolver;
    nft = (await ethers.getContract("Kleros V2 Neo Early User")) as TestERC721;

    // Juror signer setup and funding
    const { firstWallet } = await getNamedAccounts();
    juror = await ethers.getSigner(firstWallet);
    await pnk.transfer(juror.address, PNK(100_000));
    await ethers.getSigner(deployer).then((signer) => signer.sendTransaction({ to: juror.address, value: ETH(1) }));
  };

  const deploy = async () => {
    await deployUnhappy();

    // Sets up the happy path for Neo
    await nft.safeMint(deployer);
    await sortition.changeMaxStakePerJuror(PNK(10_000));
    await sortition.changeMaxTotalStaked(PNK(20_000));
  };

  const reachGeneratingPhaseFromStaking = async () => {
    const arbitrationCost = ETH(0.5);
    await resolver.createDisputeForTemplate(extraData, "", "", 2, { value: arbitrationCost });
    await network.provider.send("evm_increaseTime", [3600]);
    await network.provider.send("evm_mine");
    await sortition.passPhase(); // Staking -> Generating
    expect(await sortition.phase()).to.be.equal(1); // Generating
  };

  const reachDrawingPhase = async () => {
    expect(await sortition.phase()).to.be.equal(0); // Staking
    const arbitrationCost = ETH(0.1).mul(3);

    await core.createCourt(1, false, PNK(1000), 1000, ETH(0.1), 3, [0, 0, 0, 0], 3, [1]); // Parent - general court, Classic dispute kit

    await pnk.approve(core.address, PNK(4000));
    await core.setStake(1, PNK(2000));
    await core.setStake(2, PNK(2000));

    expect(await sortition.getJurorCourtIDs(deployer)).to.be.deep.equal([BigNumber.from("1"), BigNumber.from("2")]);

    await resolver.createDisputeForTemplate(extraData, "", "", 2, { value: arbitrationCost });

    await network.provider.send("evm_increaseTime", [2000]); // Wait for minStakingTime
    await network.provider.send("evm_mine");

    const lookahead = await sortition.rngLookahead();
    await sortition.passPhase(); // Staking -> Generating
    for (let index = 0; index < lookahead; index++) {
      await network.provider.send("evm_mine");
    }

    balanceBefore = await pnk.balanceOf(deployer);
  };

  const reachStakingPhaseAfterDrawing = async () => {
    await randomizer.relay(rng.address, 0, ethers.utils.randomBytes(32));
    await sortition.passPhase(); // Generating -> Drawing
    await core.draw(0, 10);
    await network.provider.send("evm_increaseTime", [3600]); // Ensures that maxDrawingTime has passed
    await network.provider.send("evm_mine");
    await sortition.passPhase(); // Drawing -> Staking
    expect(await sortition.phase()).to.be.equal(0); // Staking
  };

  /************************************************************************************************
    SHOULD BEHAVE LIKE A NEO ARBITRATOR
  ************************************************************************************************/

  describe("When arbitrable is not whitelisted", () => {
    before("Setup", async () => {
      await deployUnhappy();
      await core.changeArbitrableWhitelist(resolver.address, false);
    });

    it("Should fail to create a dispute", async () => {
      const arbitrationCost = ETH(0.5);
      await expect(
        resolver.createDisputeForTemplate(extraData, "", "", 2, { value: arbitrationCost })
      ).to.be.revertedWithCustomError(core, "ArbitrableNotWhitelisted");
    });
  });

  describe("When arbitrable is whitelisted", () => {
    before("Setup", async () => {
      await deployUnhappy();
      await core.changeArbitrableWhitelist(resolver.address, true);
    });

    it("Should create a dispute", async () => {
      const arbitrationCost = ETH(0.5);
      expect(await resolver.createDisputeForTemplate(extraData, "", "", 2, { value: arbitrationCost }))
        .to.emit(core, "DisputeCreation")
        .withArgs(1, resolver.address);
    });
  });

  describe("When juror has no NFT", async () => {
    before("Setup", async () => {
      await deployUnhappy();
    });

    it("Should not be able to stake", async () => {
      await pnk.connect(juror).approve(core.address, PNK(1000));
      await expect(core.connect(juror).setStake(1, PNK(1000))).to.be.revertedWithCustomError(
        core,
        "NotEligibleForStaking"
      );
    });
  });

  describe("When juror does have a NFT", async () => {
    before("Setup", async () => {
      await deployUnhappy();
      await nft.safeMint(juror.address);
    });

    it("Should be able to stake", async () => {
      await pnk.connect(juror).approve(core.address, PNK(1000));
      await expect(await core.connect(juror).setStake(1, PNK(1000)))
        .to.emit(sortition, "StakeSet")
        .withArgs(juror.address, 1, PNK(1000));
    });
  });

  describe("When juror stakes more", async () => {
    beforeEach("Setup", async () => {
      await deployUnhappy();
      await nft.safeMint(juror.address);
    });

    describe("When totalStaked is low", async () => {
      describe("When stakes are NOT delayed", () => {
        it("Should not be able to stake more than maxStakePerJuror", async () => {
          await pnk.connect(juror).approve(core.address, PNK(5000));
          await expect(core.connect(juror).setStake(1, PNK(5000))).to.be.revertedWithCustomError(
            core,
            "StakingMoreThanMaxStakePerJuror"
          );
        });
      });

      describe("When stakes are delayed", () => {
        beforeEach("Setup", async () => {
          await reachGeneratingPhaseFromStaking();
        });

        it("Should not be able to stake more than maxStakePerJuror", async () => {
          await pnk.connect(juror).approve(core.address, PNK(5000));
          await expect(core.connect(juror).setStake(1, PNK(5000))).to.be.revertedWithCustomError(
            core,
            "StakingMoreThanMaxStakePerJuror"
          );
          await reachStakingPhaseAfterDrawing();
          await expect(sortition.executeDelayedStakes(10)).to.revertedWith("No delayed stake to execute.");
        });
      });
    });

    describe("When totalStaked is close to maxTotalStaked", async () => {
      beforeEach("Setup", async () => {
        await sortition.changeMaxTotalStaked(PNK(3000));

        // deployer increases totalStaked to 2000
        await nft.safeMint(deployer);
        await pnk.approve(core.address, PNK(2000));
        await core.setStake(1, PNK(2000));
      });

      describe("When stakes are NOT delayed", () => {
        it("Should not be able to stake more than maxTotalStaked", async () => {
          await pnk.connect(juror).approve(core.address, PNK(2000));
          await expect(core.connect(juror).setStake(1, PNK(2000))).to.be.revertedWithCustomError(
            core,
            "StakingMoreThanMaxTotalStaked"
          );
        });

        it("Should be able to stake exactly maxTotalStaked", async () => {
          await pnk.connect(juror).approve(core.address, PNK(1000));
          await expect(await core.connect(juror).setStake(1, PNK(1000)))
            .to.emit(sortition, "StakeSet")
            .withArgs(juror.address, 1, PNK(1000));
        });
      });

      describe("When stakes are delayed", () => {
        beforeEach("Setup", async () => {
          await reachGeneratingPhaseFromStaking();
        });

        it("Should not be able to stake more than maxTotalStaked", async () => {
          await pnk.connect(juror).approve(core.address, PNK(2000));
          await expect(core.connect(juror).setStake(1, PNK(2000))).to.be.revertedWithCustomError(
            core,
            "StakingMoreThanMaxTotalStaked"
          );
          await reachStakingPhaseAfterDrawing();
          await expect(sortition.executeDelayedStakes(10)).to.revertedWith("No delayed stake to execute.");
        });

        it("Should be able to stake exactly maxTotalStaked", async () => {
          await pnk.connect(juror).approve(core.address, PNK(1000));
          await expect(await core.connect(juror).setStake(1, PNK(1000)))
            .to.emit(sortition, "StakeDelayedAlreadyTransferred")
            .withArgs(juror.address, 1, PNK(1000));

          await reachStakingPhaseAfterDrawing();

          await expect(await sortition.executeDelayedStakes(10))
            .to.emit(sortition, "StakeSet")
            .withArgs(juror.address, 1, PNK(1000));
        });
      });
    });
  });

  /************************************************************************************************
    SHOULD BEHAVE LIKE A REGULAR ARBITRATOR
  ************************************************************************************************/

  describe("When outside the Staking phase", async () => {
    describe("When stake is increased once", async () => {
      before("Setup", async () => {
        await deploy();
        await reachDrawingPhase();
      });

      it("Should be outside the Staking phase", async () => {
        expect(await sortition.phase()).to.be.equal(1); // Drawing
        expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(4000), 0, PNK(2000), 2]);
      });

      describe("When stake is increased", () => {
        it("Should transfer PNK but delay the stake increase", async () => {
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(0);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          await pnk.approve(core.address, PNK(1000));
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(0);
          await expect(core.setStake(2, PNK(3000)))
            .to.emit(sortition, "StakeDelayedAlreadyTransferred")
            .withArgs(deployer, 2, PNK(3000));
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(5000), 0, PNK(2000), 2]); // stake does not change
        });

        it("Should transfer some PNK out of the juror's account", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore.sub(PNK(1000))); // PNK is transferred out of the juror's account
        });

        it("Should store the delayed stake for later", async () => {
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(1);
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(1);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([deployer, 2, PNK(3000), true]);
        });
      });

      describe("When the Phase passes back to Staking", () => {
        before("Setup", async () => {
          await reachStakingPhaseAfterDrawing();
          balanceBefore = await pnk.balanceOf(deployer);
        });

        it("Should execute the delayed stakes", async () => {
          await expect(await sortition.executeDelayedStakes(10))
            .to.emit(sortition, "StakeSet")
            .withArgs(deployer, 2, PNK(3000))
            .to.not.emit(sortition, "StakeDelayedNotTransferred")
            .to.not.emit(sortition, "StakeDelayedAlreadyTransferred")
            .to.not.emit(sortition, "StakeDelayedAlreadyTransferredWithdrawn");
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([
            PNK(5000),
            PNK(300), // we're the only juror so we are drawn 3 times
            PNK(3000),
            2,
          ]); // stake unchanged, delayed
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(1);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(2);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 1st delayed stake got deleted
          expect(await sortition.delayedStakes(2)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 2nd delayed stake got deleted
          expect(await sortition.latestDelayedStakeIndex(deployer, 1)).to.be.equal(0); // no delayed stakes left
        });

        it("Should not transfer any PNK", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore); // No PNK transfer
        });
      });
    });

    describe("When stake is decreased once", async () => {
      before("Setup", async () => {
        await deploy();
        await reachDrawingPhase();
      });

      it("Should be outside the Staking phase", async () => {
        expect(await sortition.phase()).to.be.equal(1); // Drawing
        expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(4000), 0, PNK(2000), 2]);
      });

      describe("When stake is decreased", async () => {
        it("Should delay the stake decrease", async () => {
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(0);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(0);
          await expect(core.setStake(2, PNK(1000)))
            .to.emit(sortition, "StakeDelayedNotTransferred")
            .withArgs(deployer, 2, PNK(1000));
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(4000), 0, PNK(2000), 2]); // stake unchanged, delayed
        });

        it("Should not transfer any PNK", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore); // No PNK transfer yet
        });

        it("Should store the delayed stake for later", async () => {
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(1);
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(1);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([deployer, 2, PNK(1000), false]);
        });
      });

      describe("When the Phase passes back to Staking", () => {
        before("Setup", async () => {
          await reachStakingPhaseAfterDrawing();
          balanceBefore = await pnk.balanceOf(deployer);
        });

        it("Should execute the delayed stakes by withdrawing PNK and reducing the stakes", async () => {
          await expect(await sortition.executeDelayedStakes(10))
            .to.emit(sortition, "StakeSet")
            .withArgs(deployer, 2, PNK(1000));
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([
            PNK(3000),
            PNK(300), // we're the only juror so we are drawn 3 times
            PNK(1000),
            2,
          ]); // stake unchanged, delayed
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(1);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(2);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 1st delayed stake got deleted
          expect(await sortition.delayedStakes(2)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 2nd delayed stake got deleted
          expect(await sortition.latestDelayedStakeIndex(deployer, 1)).to.be.equal(0); // no delayed stakes left
        });

        it("Should withdraw some PNK", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore.add(PNK(1000))); // No PNK transfer yet
        });
      });
    });

    describe("When stake is decreased then increased back", async () => {
      before("Setup", async () => {
        await deploy();
        await reachDrawingPhase();
      });

      it("Should be outside the Staking phase", async () => {
        expect(await sortition.phase()).to.be.equal(1); // Drawing
        expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(4000), 0, PNK(2000), 2]);
      });

      describe("When stake is decreased", async () => {
        it("Should delay the stake decrease", async () => {
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(0);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(0);
          await expect(core.setStake(2, PNK(1000)))
            .to.emit(sortition, "StakeDelayedNotTransferred")
            .withArgs(deployer, 2, PNK(1000));
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(4000), 0, PNK(2000), 2]); // stake unchanged, delayed
        });

        it("Should not transfer any PNK", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore); // No PNK transfer yet
        });

        it("Should store the delayed stake for later", async () => {
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(1);
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(1);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([deployer, 2, PNK(1000), false]);
        });
      });

      describe("When stake is increased back to the previous amount", () => {
        it("Should delay the stake increase", async () => {
          balanceBefore = await pnk.balanceOf(deployer);
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(1);
          await expect(core.setStake(2, PNK(2000)))
            .to.emit(sortition, "StakeDelayedNotTransferred")
            .withArgs(deployer, 2, PNK(2000))
            .to.not.emit(sortition, "StakeDelayedAlreadyTransferredWithdrawn");
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(4000), 0, PNK(2000), 2]); // stake unchanged, delayed
        });

        it("Should not transfer any PNK", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore); // No PNK transfer yet
        });

        it("Should store the delayed stake for later", async () => {
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(2);
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(2);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 1st delayed stake got deleted
          expect(await sortition.delayedStakes(2)).to.be.deep.equal([deployer, 2, PNK(2000), false]);
        });
      });

      describe("When the Phase passes back to Staking", () => {
        before("Setup", async () => {
          await reachStakingPhaseAfterDrawing();
          balanceBefore = await pnk.balanceOf(deployer);
        });

        it("Should execute the delayed stakes but the stakes should remain the same", async () => {
          await expect(await sortition.executeDelayedStakes(10))
            .to.emit(sortition, "StakeSet")
            .withArgs(deployer, 2, PNK(2000));
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([
            PNK(4000),
            PNK(300), // we're the only juror so we are drawn 3 times
            PNK(2000),
            2,
          ]); // stake unchanged, delayed
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(2);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(3);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 1st delayed stake got deleted
          expect(await sortition.delayedStakes(2)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 2nd delayed stake got deleted
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(0); // no delayed stakes left
        });

        it("Should not transfer any PNK", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore); // No PNK transfer yet
        });
      });
    });

    describe("When stake is increased then decreased back", async () => {
      before("Setup", async () => {
        await deploy();
        await reachDrawingPhase();
      });

      it("Should be outside the Staking phase", async () => {
        expect(await sortition.phase()).to.be.equal(1); // Drawing
        expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(4000), 0, PNK(2000), 2]);
      });

      describe("When stake is increased", () => {
        it("Should transfer PNK but delay the stake increase", async () => {
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(0);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          await pnk.approve(core.address, PNK(1000));
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(0);
          await expect(core.setStake(2, PNK(3000)))
            .to.emit(sortition, "StakeDelayedAlreadyTransferred")
            .withArgs(deployer, 2, PNK(3000));
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(5000), 0, PNK(2000), 2]); // stake does not change
        });

        it("Should transfer some PNK out of the juror's account", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore.sub(PNK(1000))); // PNK is transferred out of the juror's account
        });

        it("Should store the delayed stake for later", async () => {
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(1);
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(1);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([deployer, 2, PNK(3000), true]);
        });
      });

      describe("When stake is decreased back to the previous amount", () => {
        it("Should cancel out the stake decrease back", async () => {
          balanceBefore = await pnk.balanceOf(deployer);
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(1);
          await expect(core.setStake(2, PNK(2000)))
            .to.emit(sortition, "StakeDelayedAlreadyTransferredWithdrawn")
            .withArgs(deployer, 2, PNK(1000))
            .to.emit(sortition, "StakeDelayedNotTransferred")
            .withArgs(deployer, 2, PNK(2000));
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([PNK(4000), 0, PNK(2000), 2]); // stake has changed immediately
        });

        it("Should transfer back some PNK to the juror", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore.add(PNK(1000))); // PNK is sent back to the juror
        });

        it("Should store the delayed stake for later", async () => {
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(2);
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(2);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(1);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 1st delayed stake got deleted
          expect(await sortition.delayedStakes(2)).to.be.deep.equal([deployer, 2, PNK(2000), false]);
        });
      });

      describe("When the Phase passes back to Staking", () => {
        before("Setup", async () => {
          await reachStakingPhaseAfterDrawing();
          balanceBefore = await pnk.balanceOf(deployer);
        });

        it("Should execute the delayed stakes but the stakes should remain the same", async () => {
          await expect(sortition.executeDelayedStakes(10))
            .to.emit(await sortition, "StakeSet")
            .withArgs(deployer, 2, PNK(2000))
            .to.not.emit(sortition, "StakeDelayedNotTransferred")
            .to.not.emit(sortition, "StakeDelayedAlreadyTransferred")
            .to.not.emit(sortition, "StakeDelayedAlreadyTransferredWithdrawn");
          expect(await sortition.getJurorBalance(deployer, 2)).to.be.deep.equal([
            PNK(4000),
            PNK(300), // we're the only juror so we are drawn 3 times
            PNK(2000),
            2,
          ]); // stake unchanged, delayed
          expect(await sortition.delayedStakeWriteIndex()).to.be.equal(2);
          expect(await sortition.delayedStakeReadIndex()).to.be.equal(3);
          expect(await sortition.delayedStakes(1)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 1st delayed stake got deleted
          expect(await sortition.delayedStakes(2)).to.be.deep.equal([ethers.constants.AddressZero, 0, 0, false]); // the 2nd delayed stake got deleted
          expect(await sortition.latestDelayedStakeIndex(deployer, 2)).to.be.equal(0); // no delayed stakes left
        });

        it("Should not transfer any PNK", async () => {
          expect(await pnk.balanceOf(deployer)).to.be.equal(balanceBefore); // No PNK transfer yet
        });
      });
    });
  });

  describe("When a juror is inactive", async () => {
    before("Setup", async () => {
      await deploy();
    });

    it("Should unstake from all courts", async () => {
      const arbitrationCost = ETH(0.1).mul(3);

      await core.createCourt(1, false, PNK(1000), 1000, ETH(0.1), 3, [0, 0, 0, 0], 3, [1]); // Parent - general court, Classic dispute kit

      await pnk.approve(core.address, PNK(4000));
      await core.setStake(1, PNK(2000));
      await core.setStake(2, PNK(2000));

      expect(await sortition.getJurorCourtIDs(deployer)).to.be.deep.equal([1, 2]);

      await resolver.createDisputeForTemplate(extraData, "", "", 2, { value: arbitrationCost });

      await network.provider.send("evm_increaseTime", [2000]); // Wait for minStakingTime
      await network.provider.send("evm_mine");

      const lookahead = await sortition.rngLookahead();
      await sortition.passPhase(); // Staking -> Generating
      for (let index = 0; index < lookahead; index++) {
        await network.provider.send("evm_mine");
      }
      await randomizer.relay(rng.address, 0, ethers.utils.randomBytes(32));
      await sortition.passPhase(); // Generating -> Drawing

      await core.draw(0, 5000);

      await core.passPeriod(0); // Evidence -> Voting
      await core.passPeriod(0); // Voting -> Appeal
      await core.passPeriod(0); // Appeal -> Execution

      await sortition.passPhase(); // Drawing -> Staking. Change so we don't deal with delayed stakes

      expect(await sortition.getJurorCourtIDs(deployer)).to.be.deep.equal([1, 2]);

      await core.execute(0, 0, 1); // 1 iteration should unstake from both courts

      expect(await sortition.getJurorCourtIDs(deployer)).to.be.deep.equal([]);
    });
  });
});
