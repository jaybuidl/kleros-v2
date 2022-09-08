import { deployments, getNamedAccounts, getChainId, ethers } from "hardhat";
import { KlerosCore } from "../typechain-types";
import { BigNumber } from "ethers";
import { Multicall, ContractCallContext, MulticallOptionsEthers } from "ethereum-multicall";
import courtsV1 from "../courts.v1.json";

enum HomeChains {
  ARBITRUM_ONE = 42161,
  ARBITRUM_RINKEBY = 421611,
  ARBITRUM_GOERLI = 421613,
  HARDHAT = 31337,
}

async function newMulticall(): Promise<Multicall> {
  const chainId = Number(await getChainId());
  let multicallOptions: MulticallOptionsEthers = {
    ethersProvider: ethers.provider,
    tryAggregate: false,
  };
  if (chainId === HomeChains.HARDHAT) {
    // The Multicall3 contract already exists on public chains,
    // But we need to deploy it when on the Hardhat network.
    multicallOptions = {
      ...multicallOptions,
      multicallCustomContractAddress: (await deployments.get("Multicall3")).address,
    };
  }
  return new Multicall(multicallOptions);
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

  const multicall = await newMulticall();
  const contractCallContext: ContractCallContext[] = [
    {
      reference: "KlerosCore",
      contractAddress: klerosCoreDeployment.address,
      abi: klerosCoreDeployment.abi,
      calls: [],
    },
  ];
  const addSubcourtCall = (courtId: BigNumber, _methodName: string, _methodParameters: any[]) => {
    contractCallContext[0].calls.push({
      reference: _methodName + courtId,
      methodName: _methodName,
      methodParameters: _methodParameters,
    });
  };

  addSubcourtCall(BigNumber.from(1), "changeSubcourtAlpha", [1, 123456]);
  addSubcourtCall(BigNumber.from(1), "changeSubcourtHiddenVotes", [1, true]);
  addSubcourtCall(BigNumber.from(1), "changeSubcourtJurorsForJump", [1, 2905906]);

  await core.changeGovernor((await deployments.get("Multicall3")).address);
  // Danger: risk of frontrunning between these 2 txs, overtaking the governor role! Or if the multicall tx fails.
  addSubcourtCall(BigNumber.from(1), "changeGovernor", [deployer]);

  const results = await multicall.call(contractCallContext);
  console.log("Subcourt creations: %O", results.results.KlerosCore.callsReturnContext);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
