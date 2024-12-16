import React, { useMemo } from "react";
import styled, { css } from "styled-components";

import { Button, Tooltip } from "@kleros/ui-components-library";

import Star from "svgs/icons/star.svg";

import useIsDesktop from "hooks/useIsDesktop";
import useStarredCases from "hooks/useStarredCases";

const StyledButton = styled(Button)<{ starred: boolean }>`
  background: none;
  padding: 0 0 2px 0;

  .button-svg {
    width: 24px;
    height: 24px;
    margin: 0;
    fill: none;

    path {
      stroke: ${({ theme }) => theme.secondaryPurple};
    }
    ${({ starred }) =>
      starred &&
      css`
        fill: ${({ theme }) => theme.secondaryPurple};
      `};
  }

  :hover {
    background: none;
  }
`;

const CaseStarButton: React.FC<{ id: string }> = ({ id }) => {
  const { starredCases, starCase } = useStarredCases();
  const isDesktop = useIsDesktop();
  const starred = useMemo(() => Boolean(starredCases.get(id)), [id, starredCases]);
  return (
    <Tooltip text={starred ? "Add to favorite" : "Remove from favorite"} place={isDesktop ? "top" : "bottom"}>
      <StyledButton
        Icon={Star}
        text=""
        starred={starred}
        onClick={(e) => {
          e.stopPropagation();
          starCase(id);
        }}
      />
    </Tooltip>
  );
};

export default CaseStarButton;
