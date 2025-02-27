import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { HomeChains, isMainnet, isSkipped } from "./utils";
import { ethers } from "hardhat";
import { ChainlinkRNG, SortitionModule, SortitionModuleNeo } from "../typechain-types";

const task: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, getChainId } = hre;

  // fallback to hardhat node signers on local network
  const deployer = (await getNamedAccounts()).deployer ?? (await hre.ethers.getSigners())[0].address;
  const chainId = Number(await getChainId()) as unknown as HomeChains; // Checked at runtime by skip()
  console.log("deploying to %s with deployer %s", HomeChains[chainId], deployer);

  const chainlinkRng = await ethers.getContract<ChainlinkRNG>("ChainlinkRNG");

  let sortitionModule: SortitionModule | SortitionModuleNeo;
  if (isMainnet(hre.network)) {
    console.log("Using SortitionModuleNeo");
    sortitionModule = await ethers.getContract<SortitionModuleNeo>("SortitionModuleNeo");
  } else {
    console.log("Using SortitionModule");
    sortitionModule = await ethers.getContract<SortitionModule>("SortitionModule");
  }

  console.log(`chainlinkRng.changeSortitionModule(${sortitionModule.target})`);
  await chainlinkRng.changeSortitionModule(sortitionModule.target);

  console.log(`sortitionModule.changeRandomNumberGenerator(${chainlinkRng.target}, 0)`);
  await sortitionModule.changeRandomNumberGenerator(chainlinkRng.target, 0);
};

task.tags = ["ChangeSortitionModuleRNG"];
task.skip = async ({ network }) => {
  return isSkipped(network, !HomeChains[network.config.chainId ?? 0]);
};

export default task;
