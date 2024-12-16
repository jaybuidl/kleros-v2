import React from "react";
import styled from "styled-components";

import { Route, Routes, useParams, Navigate } from "react-router-dom";

import { Card } from "@kleros/ui-components-library";

import { Periods } from "consts/periods";
import { VotingContextProvider } from "hooks/useVotingContext";

import { useDisputeDetailsQuery } from "queries/useDisputeDetailsQuery";

import { responsiveSize } from "styles/responsiveSize";

import CaseStarButton from "components/CaseStarButton";
import ScrollTop from "components/ScrollTop";

import Appeal from "./Appeal";
import Evidence from "./Evidence";
import MaintenanceButtons from "./MaintenanceButtons";
import Overview from "./Overview";
import Tabs from "./Tabs";
import Timeline from "./Timeline";
import Voting from "./Voting";

const Container = styled.div``;

const StyledCard = styled(Card)`
  width: 100%;
  height: auto;
  min-height: 100px;
`;

const HeaderContainer = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  margin-bottom: ${responsiveSize(32, 54)};
`;

const Header = styled.h1`
  display: flex;
  align-items: center;
  flex: 1;
  gap: 8px;
  margin: 0;
`;

const CaseDetails: React.FC = () => {
  const { id } = useParams();
  const { data } = useDisputeDetailsQuery(id);
  const dispute = data?.dispute;
  const currentPeriodIndex = (dispute ? Periods[dispute.period] : 0) as number;
  const arbitrable = dispute?.arbitrated.id as `0x${string}`;

  return (
    <VotingContextProvider>
      <Container>
        <HeaderContainer>
          <Header>
            Case #{id} {id ? <CaseStarButton id={id} /> : null}
          </Header>

          <MaintenanceButtons />
        </HeaderContainer>
        <Tabs />
        <Timeline {...{ currentPeriodIndex, dispute }} />
        <StyledCard>
          <Routes>
            <Route
              path="overview"
              element={
                <Overview currentPeriodIndex={currentPeriodIndex} courtID={dispute?.court.id} {...{ arbitrable }} />
              }
            />
            <Route path="evidence" element={<Evidence />} />
            <Route path="voting" element={<Voting {...{ arbitrable, currentPeriodIndex }} />} />
            <Route path="appeal" element={<Appeal {...{ currentPeriodIndex }} />} />
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Routes>
        </StyledCard>
        <ScrollTop />
      </Container>
    </VotingContextProvider>
  );
};

export default CaseDetails;
