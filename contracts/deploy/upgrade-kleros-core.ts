import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployUpgradable } from "./utils/deployUpgradable";
import { HomeChains, isSkipped } from "./utils";

const deployUpgradeKlerosCore: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { ethers, deployments, getNamedAccounts, getChainId } = hre;
  const { ZeroAddress } = hre.ethers;

  // fallback to hardhat node signers on local network
  const deployer = (await getNamedAccounts()).deployer ?? (await hre.ethers.getSigners())[0].address;
  const chainId = Number(await getChainId());
  console.log("upgrading to %s with deployer %s", HomeChains[chainId], deployer);

  try {
    const pnk = await deployments.get("PNK");
    const disputeKit = await deployments.get("DisputeKitClassic");
    const minStake = 2n * 10n ** 20n;
    const alpha = 10000;
    const feeForJuror = 10n * 17n;
    const sortitionModule = await deployments.get("SortitionModule");

    console.log("upgrading the KlerosCore...");
    await deployUpgradable(deployments, "KlerosCore", {
      from: deployer,
      args: [
        deployer,
        pnk,
        ZeroAddress,
        disputeKit.address,
        false,
        [minStake, alpha, feeForJuror, 256], // minStake, alpha, feeForJuror, jurorsForCourtJump
        [0, 0, 0, 10], // evidencePeriod, commitPeriod, votePeriod, appealPeriod
        ethers.toBeHex(5), // Extra data for sortition module will return the default value of K
        sortitionModule.address,
      ],
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
};

deployUpgradeKlerosCore.tags = ["Upgrade", "KlerosCore"];
deployUpgradeKlerosCore.skip = async ({ network }) => {
  return isSkipped(network, !HomeChains[network.config.chainId ?? 0]);
};

export default deployUpgradeKlerosCore;
