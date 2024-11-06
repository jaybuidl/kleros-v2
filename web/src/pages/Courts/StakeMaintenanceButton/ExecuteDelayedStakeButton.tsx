import React, { useMemo, useState } from "react";
import styled from "styled-components";

import { usePublicClient } from "wagmi";

import { Button } from "@kleros/ui-components-library";

import { useSimulateSortitionModule, useWriteSortitionModule } from "hooks/contracts/generated";
import {
  useReadSortitionModuleDelayedStakeReadIndex,
  useReadSortitionModuleDelayedStakeWriteIndex,
  useSortitionModulePhase,
} from "hooks/useSortitionModule";
import { wrapWithToast } from "utils/wrapWithToast";

import { isUndefined } from "src/utils";

import { Phases } from "components/Phase";

import { IBaseStakeMaintenanceButton } from ".";

const StyledButton = styled(Button)`
  width: 100%;
`;

type IExecuteStakeDelayedButton = IBaseStakeMaintenanceButton;

const ExecuteDelayedStakeButton: React.FC<IExecuteStakeDelayedButton> = ({ setIsOpen }) => {
  const [isSending, setIsSending] = useState(false);
  const publicClient = usePublicClient();
  const { data: phase } = useSortitionModulePhase();
  const { data: delayedStakeWriteIndex } = useReadSortitionModuleDelayedStakeWriteIndex();
  const { data: delayedStakeReadIndex } = useReadSortitionModuleDelayedStakeReadIndex();

  const canExecute = useMemo(() => {
    if (isUndefined(phase) || isUndefined(delayedStakeReadIndex) || isUndefined(delayedStakeWriteIndex)) return false;
    return phase === Phases.staking && delayedStakeWriteIndex >= delayedStakeReadIndex;
  }, [phase, delayedStakeReadIndex, delayedStakeWriteIndex]);

  const {
    data: executeDelayedStakeConfig,
    isLoading: isLoadingConfig,
    isError,
  } = useSimulateSortitionModule({
    query: {
      enabled: canExecute,
    },
    // eslint-disable-next-line
    // @ts-ignore
    functionName: "executeDelayedStakes",
    // eslint-disable-next-line
    // @ts-ignore
    args: [1n + (delayedStakeWriteIndex ?? 0n) - (delayedStakeReadIndex ?? 0n)],
  });

  const { writeContractAsync: executeDelayedStake } = useWriteSortitionModule();

  const isLoading = useMemo(() => isLoadingConfig || isSending, [isLoadingConfig, isSending]);
  const isDisabled = useMemo(() => isError || isLoading || !canExecute, [isError, isLoading, canExecute]);
  const handleClick = () => {
    if (!executeDelayedStakeConfig || !publicClient || !executeDelayedStake) return;

    setIsSending(true);

    wrapWithToast(async () => await executeDelayedStake(executeDelayedStakeConfig.request), publicClient).finally(
      () => {
        setIsSending(false);
        setIsOpen(false);
      }
    );
  };
  return (
    <StyledButton
      text="Execute Delayed Stakes"
      small
      isLoading={isLoading}
      disabled={isDisabled}
      onClick={handleClick}
    />
  );
};

export default ExecuteDelayedStakeButton;
