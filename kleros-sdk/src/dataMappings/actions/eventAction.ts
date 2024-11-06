import { parseAbiItem, type AbiEvent } from "viem";
import { AbiEventMapping } from "../utils/actionTypes";
import { createResultObject } from "../utils/createResultObject";
import { getPublicClient } from "../../sdk";
import { SdkNotConfiguredError } from "../../errors";

export const eventAction = async (mapping: AbiEventMapping) => {
  const publicClient = getPublicClient();

  if (!publicClient) {
    throw new SdkNotConfiguredError();
  }

  const { abi: source, address, eventFilter, seek, populate } = mapping;
  const parsedAbi = parseAbiItem(source) as AbiEvent;

  const filter = await publicClient.createEventFilter({
    address,
    event: parsedAbi,
    args: eventFilter.args,
    fromBlock: eventFilter.fromBlock,
    toBlock: eventFilter.toBlock,
  });

  const contractEvent = await publicClient.getFilterLogs({ filter });
  const eventData = contractEvent[0].args;

  return createResultObject(eventData, seek, populate);
};
