import React, { useState } from "react";
import styled from "styled-components";
import { useWalletClient, useAccount } from "wagmi";
import { Button } from "@kleros/ui-components-library";
import { uploadSettingsToSupabase } from "utils/uploadSettingsToSupabase";
import FormContact from "./FormContact";

const FormContainer = styled.form`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0 calc(12px + (32 - 12) * ((100vw - 300px) / (1250 - 300)));
  padding-bottom: 16px;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: end;
`;

const FormContactContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`;

const FormNotifs: React.FC = () => {
  const [telegramInput, setTelegramInput] = useState<string>("");
  const [emailInput, setEmailInput] = useState<string>("");
  const [telegramIsValid, setTelegramIsValid] = useState<boolean>(false);
  const [emailIsValid, setEmailIsValid] = useState<boolean>(false);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  // TODO: retrieve the current email address from the database and populate the email input with it

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nonce = new Date().getTime().toString();
    const signature = await walletClient?.signMessage({
      account: address,
      message: `Email:${emailInput},Nonce:${nonce}`,
    });
    if (!address || !signature) {
      console.error("Missing address or signature");
      return;
    }
    const data = {
      email: emailInput,
      telegram: telegramInput,
      nonce,
      address,
      signature,
    };
    await uploadSettingsToSupabase(data);
  };
  return (
    <FormContainer onSubmit={handleSubmit}>
      <FormContactContainer>
        <FormContact
          contactLabel="Telegram"
          contactPlaceholder="@my_handle"
          contactInput={telegramInput}
          contactIsValid={telegramIsValid}
          setContactInput={setTelegramInput}
          setContactIsValid={setTelegramIsValid}
          validator={/^@[a-zA-Z0-9_]{5,32}$/}
        />
      </FormContactContainer>
      <FormContactContainer>
        <FormContact
          contactLabel="Email"
          contactPlaceholder="your.email@email.com"
          contactInput={emailInput}
          contactIsValid={emailIsValid}
          setContactInput={setEmailInput}
          setContactIsValid={setEmailIsValid}
          validator={/^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/}
        />
      </FormContactContainer>

      <ButtonContainer>
        <Button text="Save" disabled={!emailIsValid} />
      </ButtonContainer>
    </FormContainer>
  );
};

export default FormNotifs;
