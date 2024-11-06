import React, { useEffect, useState } from "react";
import styled from "styled-components";

import { useParams } from "react-router-dom";

import { useDisputeDetailsQuery } from "queries/useDisputeDetailsQuery";

import { Periods } from "src/consts/periods";
import { Period } from "src/graphql/graphql";

import DottedMenuButton from "components/DottedMenuButton";
import { EnsureChain } from "components/EnsureChain";
import { Overlay } from "components/Overlay";

import DistributeRewards from "./DistributeRewards";
import DrawButton from "./DrawButton";
import ExecuteRulingButton from "./ExecuteRuling";
import PassPeriodButton from "./PassPeriodButton";
import WithdrawAppealFees from "./WithdrawAppealFees";

const Container = styled.div`
  width: 36px;
  height: 36px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
`;

const PopupContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  height: fit-content;
  overflow-y: auto;
  z-index: 31;
  padding: 27px;
  gap: 16px;
  border: 1px solid ${({ theme }) => theme.stroke};
  background-color: ${({ theme }) => theme.whiteBackground};
  border-radius: 3px;
  box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.06);

  bottom: 0;
  left: 0;
  transform: translate(-100%, 100%);
`;

export interface IBaseMaintenanceButton {
  setIsOpen: (open: boolean) => void;
  id?: string;
}

const MaintenanceButtons: React.FC = () => {
  const { id } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  const [displayRipple, setDisplayRipple] = useState(false);

  const { data } = useDisputeDetailsQuery(id);
  const dispute = data?.dispute;

  // using interval here instead of useMemo with dispute, since we can't tell when period has timed out,
  // we can use useCountdown, but that would trigger the update every 1 sec. so this is ideal.
  useEffect(() => {
    const rippleCheck = () => {
      if (!dispute) return;

      const period = Periods[dispute?.period] ?? 0;
      const now = Date.now() / 1000;

      if (
        (dispute.period !== Period.Execution &&
          now > parseInt(dispute.lastPeriodChange) + parseInt(dispute.court.timesPerPeriod[period])) ||
        (dispute.period === Period.Execution && !dispute.ruled)
      ) {
        setDisplayRipple(true);
        return;
      }

      setDisplayRipple(false);
    };

    // initial check
    rippleCheck();

    const intervalId = setInterval(() => {
      if (!dispute) return;

      if (dispute.ruled) {
        clearInterval(intervalId);
        return;
      }
      rippleCheck();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [dispute]);

  const toggle = () => setIsOpen((prevValue) => !prevValue);
  return (
    <Container>
      {isOpen ? (
        <>
          <Overlay onClick={() => setIsOpen(false)} />
          <PopupContainer>
            <EnsureChain>
              <>
                <DrawButton
                  {...{ id, setIsOpen }}
                  numberOfVotes={dispute?.currentRound.nbVotes}
                  period={dispute?.period}
                />
                <PassPeriodButton {...{ id, setIsOpen }} period={dispute?.period} />
                <ExecuteRulingButton {...{ id, setIsOpen }} period={dispute?.period} ruled={dispute?.ruled} />
                <DistributeRewards
                  {...{ id, setIsOpen }}
                  roundIndex={dispute?.currentRoundIndex}
                  period={dispute?.period}
                />
                <WithdrawAppealFees
                  {...{ id, setIsOpen }}
                  roundIndex={parseInt(dispute?.currentRoundIndex, 10)}
                  period={dispute?.period}
                  ruled={dispute?.ruled}
                />
              </>
            </EnsureChain>
          </PopupContainer>
        </>
      ) : null}
      <DottedMenuButton {...{ toggle, displayRipple }} />
    </Container>
  );
};

export default MaintenanceButtons;
