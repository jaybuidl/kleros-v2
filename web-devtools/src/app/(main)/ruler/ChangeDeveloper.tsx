import React, { useCallback, useMemo, useState } from "react";
import styled from "styled-components";

import { type Address, isAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { Button } from "@kleros/ui-components-library";

import { DEFAULT_CHAIN } from "consts/chains";
import { useRulerContext } from "context/RulerContext";
import { useSimulateKlerosCoreRulerChangeRuler, useWriteKlerosCoreRulerChangeRuler } from "hooks/contracts/generated";
import { isUndefined } from "utils/isUndefined";
import { wrapWithToast } from "utils/wrapWithToast";

import LabeledInput from "components/LabeledInput";

import Header from "./Header";

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StyledLabel = styled.label`
  word-wrap: break-word;
`;

const ChangeDeveloper: React.FC = () => {
  const { isConnected, chainId } = useAccount();
  const { arbitrable, currentDeveloper, refetchData } = useRulerContext();
  const [newDeveloper, setNewDeveloper] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const publicClient = usePublicClient();

  const isValid = useMemo(() => newDeveloper === "" || isAddress(newDeveloper), [newDeveloper]);

  const {
    data: changeRulerConfig,
    isLoading,
    isError,
  } = useSimulateKlerosCoreRulerChangeRuler({
    query: {
      enabled:
        !isUndefined(arbitrable) && !isUndefined(newDeveloper) && isAddress(arbitrable) && isAddress(newDeveloper),
    },
    args: [arbitrable as Address, newDeveloper as Address],
  });

  const { writeContractAsync: changeRuler } = useWriteKlerosCoreRulerChangeRuler();

  const handleClick = useCallback(() => {
    if (!publicClient || !changeRulerConfig) return;
    setIsChanging(true);
    wrapWithToast(async () => changeRuler(changeRulerConfig.request), publicClient)
      .then(() => refetchData())
      .finally(() => setIsChanging(false));
  }, [publicClient, changeRulerConfig, changeRuler, refetchData]);

  const isDisabled = useMemo(
    () =>
      !isConnected ||
      chainId !== DEFAULT_CHAIN ||
      !changeRulerConfig ||
      isError ||
      isLoading ||
      isChanging ||
      isUndefined(arbitrable) ||
      !isValid,
    [changeRulerConfig, isError, isLoading, isChanging, arbitrable, isValid, isConnected, chainId]
  );
  return (
    <Container>
      <Header text="Developer" tooltipMsg="Address of the current ruler of the selected arbitrable" />
      <InputContainer>
        <StyledLabel>Current Developer : {currentDeveloper ?? "None"}</StyledLabel>
        <LabeledInput
          label="New Developer"
          onChange={(e) => setNewDeveloper(e.target.value)}
          message={isValid ? "" : "Invalid Address"}
          variant={isValid ? "" : "error"}
        />
      </InputContainer>
      <Button text="Update" onClick={handleClick} isLoading={isLoading || isChanging} disabled={isDisabled} />
    </Container>
  );
};

export default ChangeDeveloper;
