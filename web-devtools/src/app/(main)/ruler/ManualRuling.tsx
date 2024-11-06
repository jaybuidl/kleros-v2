"use client";
import React, { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

import { RULING_MODE } from "consts";
import { useAccount, usePublicClient } from "wagmi";

import { Button } from "@kleros/ui-components-library";

import { useRulerContext } from "context/RulerContext";
import {
  useSimulateKlerosCoreRulerChangeRulingModeToManual,
  useSimulateKlerosCoreRulerExecuteRuling,
  useWriteKlerosCoreRulerChangeRulingModeToManual,
  useWriteKlerosCoreRulerExecuteRuling,
} from "hooks/contracts/generated";
import { isUndefined } from "utils/isUndefined";
import { wrapWithToast } from "utils/wrapWithToast";

import LabeledInput from "components/LabeledInput";

import Header from "./Header";
import { DEFAULT_CHAIN } from "consts/chains";

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const SelectContainer = styled.div`
  display: flex;
  gap: 16px;
  justify-content: space-around;
  flex-wrap: wrap;
`;

const ManualRuling: React.FC = () => {
  const { isConnected, chainId } = useAccount();
  const { arbitrable, arbitrableSettings } = useRulerContext();
  const [isSending, setIsSending] = useState<boolean>(false);
  const [tie, setTie] = useState(arbitrableSettings?.tied ?? false);
  const [overridden, setOverridden] = useState(arbitrableSettings?.overridden ?? false);
  const [ruling, setRuling] = useState(arbitrableSettings?.ruling);
  const [disputeId, setDisputeId] = useState<number>();

  const publicClient = usePublicClient();

  const { data: manualModeConfig } = useSimulateKlerosCoreRulerChangeRulingModeToManual({
    query: {
      enabled: arbitrableSettings?.rulingMode !== RULING_MODE.Manual && !isUndefined(arbitrable),
    },
    args: [arbitrable as `0x${string}`],
  });
  const { writeContractAsync: changeToManualMode } = useWriteKlerosCoreRulerChangeRulingModeToManual();

  const isDisabled = useMemo(() => {
    return (
      !isConnected ||
      chainId !== DEFAULT_CHAIN ||
      isUndefined(disputeId) ||
      isUndefined(ruling) ||
      isUndefined(arbitrable)
    );
  }, [disputeId, ruling, arbitrable, isConnected, chainId]);

  const {
    data: executeConfig,
    isLoading: isLoadingExecuteConfig,
    isError,
  } = useSimulateKlerosCoreRulerExecuteRuling({
    query: {
      enabled: arbitrableSettings?.rulingMode === RULING_MODE.Manual && !isUndefined(arbitrable) && !isDisabled,
    },
    args: [BigInt(disputeId ?? 0), BigInt(ruling ?? 0), tie, overridden],
  });

  const { writeContractAsync: executeRuling } = useWriteKlerosCoreRulerExecuteRuling();

  const handleRuling = useCallback(async () => {
    if (!publicClient) return;
    if (arbitrableSettings?.rulingMode !== RULING_MODE.Manual) {
      if (!manualModeConfig) return;
      setIsSending(true);

      wrapWithToast(async () => await changeToManualMode(manualModeConfig.request), publicClient)
        .then(async (res) => {
          if (res.status && executeConfig) {
            wrapWithToast(async () => await executeRuling(executeConfig.request), publicClient);
          }
        })
        .finally(() => setIsSending(false));
    } else if (executeConfig) {
      setIsSending(true);

      wrapWithToast(async () => await executeRuling(executeConfig.request), publicClient).finally(() =>
        setIsSending(false)
      );
    }
  }, [publicClient, executeConfig, manualModeConfig, arbitrableSettings, changeToManualMode, executeRuling]);

  return (
    <Container>
      <Header
        text="Manual Ruling"
        tooltipMsg="Provide Manual ruling for the arbitrator. This operation will change the ruling mode to Manual, if the ruling mode is not Manual"
      />
      <SelectContainer>
        <LabeledInput
          label="Dispute ID"
          type="number"
          value={disputeId}
          onChange={(e) => setDisputeId(Number(e.target.value))}
        />

        <LabeledInput label="Ruling" type="number" value={ruling} onChange={(e) => setRuling(Number(e.target.value))} />
        <LabeledInput label="Tie" inputType="checkbox" checked={tie} onChange={() => setTie((prev) => !prev)} />
        <LabeledInput
          label="Overridden"
          inputType="checkbox"
          checked={overridden}
          onChange={() => setOverridden((prev) => !prev)}
        />
      </SelectContainer>
      <Button
        text="Rule"
        onClick={handleRuling}
        isLoading={isLoadingExecuteConfig || isSending}
        disabled={isDisabled || isError || isSending || isLoadingExecuteConfig}
      />
    </Container>
  );
};

export default ManualRuling;
