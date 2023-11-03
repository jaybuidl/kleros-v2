import React, { useState } from "react";
import styled from "styled-components";
import { useToggle } from "react-use";
import HowItWorks from "./HowItWorks";
import PnkLogoAndTitle from "./PnkLogoAndTitle";
import WhatDoINeed from "./WhatDoINeed";
import Staking from "../Staking";
import BinaryVoting from "../BinaryVoting";
import RankedVoting from "../RankedVoting";
import Appeal from "../Appeal";
import JurorLevels from "../JurorLevels";
import Template, { Title, ParagraphsContainer, LeftContentContainer } from "../Template";

const StyledLabel = styled.label`
  color: ${({ theme }) => theme.primaryBlue};
  margin: 0;
  cursor: pointer;
`;

const LinksContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const leftPageContents = [
  {
    title: "Welcome to Kleros Court",
    paragraphs: ["The decentralized arbitration service for the disputes of the new economy.", "Learn what’s new"],
    links: [],
  },
  {
    title: "What do I need to start?",
    paragraphs: [
      "Do you want to be a juror? If yes, you will need PNK tokens for staking on courts, and ETH for gas fees.",
      "I don't want to be a juror. Can I still participate in the Court? Yes, sure. Users can also participate as" +
        " contributors by helping fund appeal fees in exchange for rewards, or by submitting evidence." +
        " In this case, you will need ETH.",
      "I have a case that needs resolution? What do I do? It's simple. Send your case to Kleros and receive" +
        " the resolution. You will need a few minutes to fill up the details of your case, and ETH to pay for" +
        " Arbitration fees (It's used to pay jurors for their work).",
    ],
    links: [],
  },
  {
    title: "Access the Mini Guides",
    paragraphs: [],
    links: ["1. Staking", "2. Binary Voting", "3. Ranked Voting", "4. Appeal", "5. Juror Levels"],
  },
];

const rightPageComponents = [() => <PnkLogoAndTitle />, () => <WhatDoINeed />, () => <HowItWorks />];

const extractGuideName = (linkText) => linkText.split(". ")[1];

const LeftContent: React.FC<{ currentPage: number; toggleMiniGuide: (guideName: string) => void }> = ({
  currentPage,
  toggleMiniGuide,
}) => {
  const { title, paragraphs, links } = leftPageContents[currentPage - 1];

  return (
    <LeftContentContainer>
      <Title>{title}</Title>
      <ParagraphsContainer>
        {paragraphs.map((paragraph, index) => (
          <label key={index}>{paragraph}</label>
        ))}
      </ParagraphsContainer>
      <LinksContainer>
        {links.map((link, index) => (
          <StyledLabel key={index} onClick={() => toggleMiniGuide(extractGuideName(link))}>
            {link}
          </StyledLabel>
        ))}
      </LinksContainer>
    </LeftContentContainer>
  );
};

const RightContent: React.FC<{ currentPage: number }> = ({ currentPage }) => {
  const RightPageComponent = rightPageComponents[currentPage - 1];

  return <RightPageComponent />;
};

interface IOnboarding {
  toggleIsOnboardingMiniGuidesOpen: () => void;
}

const Onboarding: React.FC<IOnboarding> = ({ toggleIsOnboardingMiniGuidesOpen }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isStakingMiniGuideOpen, toggleStakingMiniGuide] = useToggle(false);
  const [isBinaryVotingMiniGuideOpen, toggleBinaryVotingMiniGuide] = useToggle(false);
  const [isRankedVotingMiniGuideOpen, toggleRankedVotingMiniGuide] = useToggle(false);
  const [isAppealMiniGuideOpen, toggleAppealMiniGuide] = useToggle(false);
  const [isJurorLevelsMiniGuideOpen, toggleJurorLevelsMiniGuide] = useToggle(false);

  const isAnyMiniGuideOpen =
    isStakingMiniGuideOpen ||
    isBinaryVotingMiniGuideOpen ||
    isRankedVotingMiniGuideOpen ||
    isAppealMiniGuideOpen ||
    isJurorLevelsMiniGuideOpen;

  const canCloseOnboarding =
    !isStakingMiniGuideOpen &&
    !isBinaryVotingMiniGuideOpen &&
    !isRankedVotingMiniGuideOpen &&
    !isAppealMiniGuideOpen &&
    !isJurorLevelsMiniGuideOpen;

  const toggleMiniGuide = (guideName: string) => {
    if (guideName === "Staking") {
      toggleStakingMiniGuide();
    } else if (guideName === "Binary Voting") {
      toggleBinaryVotingMiniGuide();
    } else if (guideName === "Ranked Voting") {
      toggleRankedVotingMiniGuide();
    } else if (guideName === "Appeal") {
      toggleAppealMiniGuide();
    } else if (guideName === "Juror Levels") {
      toggleJurorLevelsMiniGuide();
    }
  };

  return (
    <>
      <Template
        LeftContent={<LeftContent currentPage={currentPage} toggleMiniGuide={toggleMiniGuide} />}
        RightContent={<RightContent currentPage={currentPage} />}
        onClose={toggleIsOnboardingMiniGuidesOpen}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        numPages={leftPageContents.length}
        isOnboarding={true}
        canClose={canCloseOnboarding}
        isVisible={!isAnyMiniGuideOpen}
      />

      {isStakingMiniGuideOpen && <Staking toggleMiniGuide={toggleStakingMiniGuide} />}
      {isBinaryVotingMiniGuideOpen && <BinaryVoting toggleMiniGuide={toggleBinaryVotingMiniGuide} />}
      {isRankedVotingMiniGuideOpen && <RankedVoting toggleMiniGuide={toggleRankedVotingMiniGuide} />}
      {isAppealMiniGuideOpen && <Appeal toggleMiniGuide={toggleAppealMiniGuide} />}
      {isJurorLevelsMiniGuideOpen && <JurorLevels toggleMiniGuide={toggleJurorLevelsMiniGuide} />}
    </>
  );
};

export default Onboarding;
