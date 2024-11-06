import React, { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

import { RULING_MODE } from "consts";
import { useAccount, usePublicClient } from "wagmi";

import { Button, Radio } from "@kleros/ui-components-library";

import { useRulerContext } from "context/RulerContext";
import {
  useSimulateKlerosCoreRulerChangeRulingModeToAutomaticPreset,
  useSimulateKlerosCoreRulerChangeRulingModeToAutomaticRandom,
  useSimulateKlerosCoreRulerChangeRulingModeToManual,
  useWriteKlerosCoreRulerChangeRulingModeToAutomaticPreset,
  useWriteKlerosCoreRulerChangeRulingModeToAutomaticRandom,
  useWriteKlerosCoreRulerChangeRulingModeToManual,
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
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 16px;
`;

const AutomaticPresetInputsContainer = styled.div`
  display: flex;
  gap: 16px;
  justify-content: space-around;
  flex-wrap: wrap;
`;

const StyledLabel = styled.label``;

const RulingModes: React.FC = () => {
  const { isConnected, chainId } = useAccount();
  const { arbitrable, arbitrableSettings } = useRulerContext();
  const [rulingMode, setRulingMode] = useState<RULING_MODE>(RULING_MODE.Uninitialized);
  const [tie, setTie] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [ruling, setRuling] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const publicClient = usePublicClient();

  const {
    data: manualModeConfig,
    isError: manualModeConfigError,
    isLoading: isLoadingManualConfig,
  } = useSimulateKlerosCoreRulerChangeRulingModeToManual({
    query: {
      enabled:
        rulingMode === RULING_MODE.Manual &&
        !isUndefined(arbitrable) &&
        arbitrableSettings?.rulingMode !== RULING_MODE.Manual,
    },
    args: [arbitrable as `0x${string}`],
  });
  const { writeContractAsync: changeToManualMode, isPending: isChangingToManualMode } =
    useWriteKlerosCoreRulerChangeRulingModeToManual();

  const {
    data: automaticPresetConfig,
    isError: automaticPresetConfigError,
    isLoading: isLoadingAutomaticPresetConfig,
  } = useSimulateKlerosCoreRulerChangeRulingModeToAutomaticPreset({
    query: {
      enabled:
        rulingMode === RULING_MODE.AutomaticPreset &&
        !isUndefined(arbitrable) &&
        (arbitrableSettings?.rulingMode !== RULING_MODE.AutomaticPreset ||
          arbitrableSettings?.ruling !== ruling ||
          arbitrableSettings?.tied !== tie ||
          arbitrableSettings?.overridden !== overridden),
    },
    args: [arbitrable as `0x${string}`, BigInt(ruling), tie, overridden],
  });
  const { writeContractAsync: changeToAutomaticPreset, isPending: isChangingToAutomaticPreset } =
    useWriteKlerosCoreRulerChangeRulingModeToAutomaticPreset();

  const {
    data: automaticRandomConfig,
    isError: automaticRandomConfigError,
    isLoading: isLoadingAutomaticRandomConfig,
  } = useSimulateKlerosCoreRulerChangeRulingModeToAutomaticRandom({
    query: {
      enabled:
        rulingMode === RULING_MODE.AutomaticRandom &&
        !isUndefined(arbitrable) &&
        arbitrableSettings?.rulingMode !== RULING_MODE.AutomaticRandom,
    },
    args: [arbitrable as `0x${string}`],
  });
  const { writeContractAsync: changeToAutomaticRandom, isPending: isChangingToAutomaticRandom } =
    useWriteKlerosCoreRulerChangeRulingModeToAutomaticRandom();

  const isDisabled = useMemo(() => {
    if (!arbitrable || !isConnected || chainId !== DEFAULT_CHAIN) return true;
    switch (rulingMode) {
      case RULING_MODE.Manual:
        return (
          rulingMode === arbitrableSettings?.rulingMode ||
          manualModeConfigError ||
          isChangingToManualMode ||
          isLoadingManualConfig
        );
      case RULING_MODE.AutomaticPreset:
        return (
          automaticPresetConfigError ||
          isChangingToAutomaticPreset ||
          isLoadingAutomaticPresetConfig ||
          (rulingMode === arbitrableSettings?.rulingMode &&
            arbitrableSettings?.ruling === ruling &&
            arbitrableSettings?.tied === tie &&
            arbitrableSettings?.overridden === overridden)
        );
      default:
        return (
          rulingMode === arbitrableSettings?.rulingMode ||
          automaticRandomConfigError ||
          isChangingToAutomaticRandom ||
          isLoadingAutomaticRandomConfig
        );
    }
  }, [
    arbitrable,
    rulingMode,
    manualModeConfigError,
    isChangingToManualMode,
    automaticPresetConfigError,
    isChangingToAutomaticPreset,
    automaticRandomConfigError,
    isChangingToAutomaticRandom,
    isLoadingManualConfig,
    isLoadingAutomaticRandomConfig,
    isLoadingAutomaticPresetConfig,
    arbitrableSettings,
    tie,
    overridden,
    ruling,
    isConnected,
    chainId,
  ]);

  const isLoading = useMemo(() => {
    switch (rulingMode) {
      case RULING_MODE.Manual:
        return isChangingToManualMode || isLoadingManualConfig;
      case RULING_MODE.AutomaticPreset:
        return isChangingToAutomaticPreset || isLoadingAutomaticPresetConfig;
      default:
        return isChangingToAutomaticRandom || isLoadingAutomaticRandomConfig;
    }
  }, [
    rulingMode,
    isChangingToManualMode,
    isChangingToAutomaticPreset,
    isChangingToAutomaticRandom,
    isLoadingManualConfig,
    isLoadingAutomaticRandomConfig,
    isLoadingAutomaticPresetConfig,
  ]);

  const handleUpdate = useCallback(() => {
    if (!publicClient) return;
    setIsSending(true);
    switch (rulingMode) {
      case RULING_MODE.Manual:
        if (!manualModeConfig) return;
        wrapWithToast(async () => await changeToManualMode(manualModeConfig.request), publicClient).finally(() =>
          setIsSending(false)
        );
        return;
      case RULING_MODE.AutomaticPreset:
        if (!automaticPresetConfig) return;
        wrapWithToast(async () => await changeToAutomaticPreset(automaticPresetConfig.request), publicClient).finally(
          () => setIsSending(false)
        );
        return;
      default:
        if (!automaticRandomConfig) return;
        wrapWithToast(async () => await changeToAutomaticRandom(automaticRandomConfig.request), publicClient).finally(
          () => setIsSending(false)
        );
        return;
    }
  }, [
    rulingMode,
    automaticPresetConfig,
    manualModeConfig,
    automaticRandomConfig,
    publicClient,
    changeToAutomaticPreset,
    changeToAutomaticRandom,
    changeToManualMode,
  ]);

  return (
    <Container>
      <Header
        text="Ruling Mode"
        tooltipMsg="Current Ruling mode of the arbitrator. Learn more about ruling modes here."
      />
      <StyledLabel>
        Current mode: <small>{getRulingModeText(arbitrableSettings?.rulingMode)}</small>
      </StyledLabel>
      <SelectContainer>
        <Radio
          small
          label="Manual"
          checked={rulingMode === RULING_MODE.Manual}
          onChange={() => {
            setRulingMode(RULING_MODE.Manual);
          }}
        />
        <Radio
          small
          label="Random Preset"
          defaultChecked={arbitrableSettings?.rulingMode === RULING_MODE.AutomaticRandom}
          checked={rulingMode === RULING_MODE.AutomaticRandom}
          onChange={() => {
            setRulingMode(RULING_MODE.AutomaticRandom);
          }}
        />
        <Radio
          small
          label="Automatic Preset"
          checked={rulingMode === RULING_MODE.AutomaticPreset}
          onChange={() => {
            setRulingMode(RULING_MODE.AutomaticPreset);
          }}
        />
        {rulingMode === RULING_MODE.AutomaticPreset && (
          <AutomaticPresetInputsContainer>
            <LabeledInput
              label="Ruling"
              type="number"
              value={ruling}
              onChange={(e) => setRuling(Number(e.target.value))}
              disabled={rulingMode !== RULING_MODE.AutomaticPreset}
            />
            <LabeledInput
              label="Tie"
              inputType="checkbox"
              checked={tie}
              onChange={() => setTie((prev) => !prev)}
              disabled={rulingMode !== RULING_MODE.AutomaticPreset}
            />
            <LabeledInput
              label="Overridden"
              inputType="checkbox"
              checked={overridden}
              onChange={() => setOverridden((prev) => !prev)}
              disabled={rulingMode !== RULING_MODE.AutomaticPreset}
            />
          </AutomaticPresetInputsContainer>
        )}
      </SelectContainer>
      <Button
        text="Update"
        onClick={handleUpdate}
        isLoading={isLoading || isSending}
        disabled={isDisabled || isSending}
      />
    </Container>
  );
};

const getRulingModeText = (mode?: RULING_MODE) => {
  if (!mode) return "Uninitialized";
  switch (mode) {
    case RULING_MODE.Manual:
      return "Manual";
    case RULING_MODE.AutomaticRandom:
      return "Automatic Random";
    case RULING_MODE.AutomaticPreset:
      return "Automatic Preset";
    default:
      return "Uninitialized";
  }
};

export default RulingModes;
