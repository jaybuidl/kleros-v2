import React, { useCallback, useMemo, useState } from "react";
import styled from "styled-components";
import { useParams } from "react-router-dom";
import { useWalletClient, usePublicClient, useConfig } from "wagmi";
import { simulateDisputeKitClassicCastVote } from "hooks/contracts/generated";
import { wrapWithToast } from "utils/wrapWithToast";
import { useDisputeDetailsQuery } from "queries/useDisputeDetailsQuery";
import OptionsContainer from "./OptionsContainer";

const Container = styled.div`
  width: 100%;
  height: auto;
`;

interface IVote {
  arbitrable: `0x${string}`;
  voteIDs: string[];
  setIsOpen: (val: boolean) => void;
}

const Vote: React.FC<IVote> = ({ arbitrable, voteIDs, setIsOpen }) => {
  const { id } = useParams();
  const parsedDisputeID = useMemo(() => BigInt(id ?? 0), [id]);
  const parsedVoteIDs = useMemo(() => voteIDs.map((voteID) => BigInt(voteID)), [voteIDs]);
  const { data: disputeData } = useDisputeDetailsQuery(id);
  const [justification, setJustification] = useState("");
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const wagmiConfig = useConfig();

  const handleVote = useCallback(
    async (voteOption: number) => {
      const { request } = await simulateDisputeKitClassicCastVote(wagmiConfig, {
        args: [
          parsedDisputeID,
          parsedVoteIDs,
          BigInt(voteOption),
          BigInt(disputeData?.dispute?.currentRoundIndex),
          justification,
        ],
      });
      if (walletClient) {
        await wrapWithToast(async () => await walletClient.writeContract(request), publicClient).then(() => {
          setIsOpen(true);
        });
      }
    },
    [
      wagmiConfig,
      disputeData?.dispute?.currentRoundIndex,
      justification,
      parsedVoteIDs,
      parsedDisputeID,
      publicClient,
      setIsOpen,
      walletClient,
    ]
  );

  return (
    <Container>
      <OptionsContainer {...{ arbitrable, justification, setJustification, handleSelection: handleVote }} />
    </Container>
  );
};

export default Vote;
