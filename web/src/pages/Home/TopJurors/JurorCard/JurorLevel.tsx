import React from "react";
import styled, { css } from "styled-components";

import { getUserLevelData } from "utils/userLevelCalculation";

import { landscapeStyle } from "styles/landscapeStyle";

import PixelArt from "pages/Profile/JurorInfo/PixelArt";
import { getPercent } from "./Coherence";

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  ${landscapeStyle(
    () => css`
      gap: 16px;
      justify-content: end;
    `
  )}
`;

const StyledLabel = styled.label`
  font-size: 12px !important;

  &::before {
    content: "Lv. ";
  }

  ${landscapeStyle(
    () => css`
      font-size: 16px !important;

      &::before {
        content: "Level ";
      }
    `
  )}
`;

interface IJurorLevel {
  totalCoherentVotes: string;
  totalResolvedVotes: string;
  totalResolvedDisputes: string;
}

const JurorLevel: React.FC<IJurorLevel> = ({ totalCoherentVotes, totalResolvedVotes, totalResolvedDisputes }) => {
  const coherencePercentage = getPercent(Number(totalCoherentVotes), Number(totalResolvedVotes));
  const userLevelData = getUserLevelData(coherencePercentage, Number(totalResolvedDisputes));
  const level = userLevelData.level;

  return (
    <Container>
      <StyledLabel>{level}</StyledLabel>
      <PixelArt width="32px" height="32px" level={level} />
    </Container>
  );
};
export default JurorLevel;
