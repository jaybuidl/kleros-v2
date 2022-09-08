import { deployments, getNamedAccounts, getChainId, ethers } from "hardhat";
import { KlerosCore } from "../typechain-types";
import { BigNumber } from "ethers";
import {
  Contract as MulticallContract,
  Provider as MulticallProvider,
  setMulticallAddress,
  ContractCall,
} from "ethers-multicall";
import courtsV1 from "../courts.v1.json";

enum HomeChains {
  ARBITRUM_ONE = 42161,
  ARBITRUM_RINKEBY = 421611,
  ARBITRUM_GOERLI = 421613,
  HARDHAT = 31337,
}

async function newMulticall(): Promise<[MulticallProvider, MulticallContract]> {
  const chainId = Number(await getChainId());
  const multicallProvider = new MulticallProvider(ethers.provider, chainId);
  if (chainId === HomeChains.HARDHAT) {
    // The Multicall3 contract already exists on public chains,
    // But we need to deploy it when on the Hardhat network.
    setMulticallAddress(31337, (await deployments.get("Multicall3")).address);
  }

  const klerosCoreDeployment = await deployments.get("KlerosCore");
  const multicallCore = new MulticallContract(klerosCoreDeployment.address, klerosCoreDeployment.abi);
  return [multicallProvider, multicallCore];
}

async function main() {
  // fallback to hardhat node signers on local network
  const deployer = (await getNamedAccounts()).deployer ?? (await ethers.getSigners())[0].address;

  const chainId = Number(await getChainId());
  if (!HomeChains[chainId]) {
    console.error(`Aborting: script is not compatible with ${chainId}`);
    return;
  } else {
    console.log("deploying to %s with deployer %s", HomeChains[chainId], deployer);
  }

  // WARNING: skip the Forking court at id 0, so the v1 courts are shifted by 1
  const courtsV2 = courtsV1.map((court) => ({
    ...court,
    id: BigNumber.from(court.id).add(1),
    parent: BigNumber.from(court.parent).add(1),
  }));

  console.log("courtsV2 = %O", courtsV2);

  const klerosCoreDeployment = await deployments.get("KlerosCore");
  const core = (await ethers.getContractAt("KlerosCore", klerosCoreDeployment.address)) as KlerosCore;

  const [multicallProvider, multicallCore] = await newMulticall();
  const subcourtCalls: ContractCall[] = [];

  subcourtCalls.push(
    multicallCore.changeSubcourtHiddenVotes(1, true),
    multicallCore.changeSubcourtAlpha(1, 123456),
    multicallCore.changeSubcourtJurorsForJump(1, 2905906)
  );

  await core.changeGovernor((await deployments.get("Multicall3")).address);
  // Danger: risk of frontrunning between these 2 txs, overtaking the governor role! Or if the multicall tx fails.
  subcourtCalls.push(multicallCore.changeGovernor(deployer));

  const results = await multicallProvider.all(subcourtCalls);
  console.log("Subcourt creations: %O", results);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
