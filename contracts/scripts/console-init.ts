// .load scripts/console-init.ts
me = (await ethers.provider.listAccounts())[0];
core = await ethers.getContract("KlerosCore");
disputeKit = await ethers.getContract("DisputeKitClassic");
pnk = await ethers.getContract("PNK");
registry = await ethers.getContract("PolicyRegistry");
rng = await ethers.getContract("RandomizerRNG");
rng2 = await ethers.getContract("BlockHashRNG");
gateway = await ethers.getContract("HomeGatewayToGnosis");
sender = await ethers.getContract("FastBridgeSenderToGnosis");
resolver = await ethers.getContract("DisputeResolver");
options = { gasLimit: 10000000, gasPrice: 5000000000 };
var disputeID = 0;

console.log("core phase: %s", await core.phase());
console.log("disputekit phase: %s", await disputeKit.phase());
console.log("freezingPhase timeout? %s", await core.freezingPhaseTimeout());

const createDisputeOnResolver = async () => {
  const choices = 2;
  const nbOfJurors = 3;
  const feeForJuror = (await core.courts(1)).feeForJuror;
  var tx;
  try {
    tx = await (
      await resolver.createDispute(
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003",
        "",
        2,
        {
          value: feeForJuror.mul(nbOfJurors),
          ...options,
        }
      )
    ).wait();
    console.log("txID: %s", tx?.transactionHash);
  } catch (e) {
    if (typeof e === "string") {
      console.log("Error: %s", e);
    } else if (e instanceof Error) {
      console.log("%O", e);
    }
  } finally {
    if (tx) {
      const filter = core.filters.DisputeCreation();
      const logs = await core.queryFilter(filter, tx.blockNumber, tx.blockNumber);
      console.log("DisputeID: %s", logs[0]?.args?._disputeID);
    }
  }
};

const passPhaseDk = async () => {
  const before = await disputeKit.phase();
  var tx;
  try {
    tx = await (await disputeKit.passPhase(options)).wait();
    console.log("txID: %s", tx?.transactionHash);
  } catch (e) {
    if (typeof e === "string") {
      console.log("Error: %s", e);
    } else if (e instanceof Error) {
      console.log("%O", e);
    }
  } finally {
    const after = await disputeKit.phase();
    console.log("Phase: %d -> %d", before, after);
  }
};

const passPhaseCore = async () => {
  const before = await core.phase();
  var tx;
  try {
    tx = await (await core.passPhase(options)).wait();
    console.log("txID: %s", tx?.transactionHash);
  } catch (e) {
    if (typeof e === "string") {
      console.log("Error: %s", e);
    } else if (e instanceof Error) {
      console.log("%O", e);
    }
  } finally {
    const after = await core.phase();
    console.log("Phase: %d -> %d", before, after);
  }
};

const passPeriod = async () => {
  const before = (await core.disputes(disputeID)).period;
  var tx;
  try {
    tx = await (await core.passPeriod(disputeID, options)).wait();
    console.log("txID: %s", tx?.transactionHash);
  } catch (e) {
    if (typeof e === "string") {
      console.log("Error: %s", e);
    } else if (e instanceof Error) {
      console.log("%O", e);
    }
  } finally {
    const after = (await core.disputes(disputeID)).period;
    console.log("Period for dispute %s: %d -> %d", disputeID, before, after);
  }
};

const drawJurors = async () => {
  var info = await core.getRoundInfo(disputeID, 0);
  console.log("Drawn jurors before: %O", info.drawnJurors);
  let tx;
  try {
    tx = await (await core.draw(disputeID, 10, options)).wait();
    console.log("txID: %s", tx?.transactionHash);
  } catch (e) {
    if (typeof e === "string") {
      console.log("Error: %s", e);
    } else if (e instanceof Error) {
      console.log("%O", e);
    }
  } finally {
    info = await core.getRoundInfo(disputeID, 0);
    console.log("Drawn jurors after: %O", info.drawnJurors);
  }
};

const isRngReady = async () => {
  const requesterID = await rng.requesterToID(disputeKit.address);
  const n = await rng.randomNumbers(requesterID);
  if (n.eq(0)) {
    console.log("rng is NOT ready.");
  } else {
    console.log("rng is ready: %s", n.toString());
  }
};

const getRoundInfo = async () => {
  console.log("%O", await core.getRoundInfo(disputeID, 0));
};

const executeRuling = async () => {
  let tx;
  try {
    tx = await (await core.execute(disputeID, 0, 10)).wait(); // redistribute
    console.log("txID execute: %s", tx?.transactionHash);

    tx = await (await core.executeRuling(disputeID)).wait(); // rule
    console.log("txID executeRuling: %s", tx?.transactionHash);
  } catch (e) {
    if (typeof e === "string") {
      console.log("Error: %s", e);
    } else if (e instanceof Error) {
      console.log("%O", e);
    }
  } finally {
    const dispute = await core.disputes(0);
    console.log("Ruled? %s", dispute.ruled);

    const ruling = await core.currentRuling(disputeID);
    console.log("Ruling: %d, Tied? %s, Overridden? %s", ruling.ruling, ruling.tied, ruling.overridden);
  }
};
