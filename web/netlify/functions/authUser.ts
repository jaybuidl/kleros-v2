import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import { ETH_SIGNATURE_REGEX } from "src/consts";
import { SiweMessage } from "siwe";
import * as jwt from "jose";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../../src/types/supabase-notification";

const authUser = async (event) => {
  try {
    if (!event.body) {
      throw new Error("No body provided");
    }

    const signature = event?.body?.signature;
    if (!signature) {
      throw new Error("Missing key : signature");
    }

    if (!ETH_SIGNATURE_REGEX.test(signature)) {
      throw new Error("Invalid signature");
    }

    const message = event?.body?.message;
    if (!message) {
      throw new Error("Missing key : message");
    }

    const address = event?.body?.address;
    if (!address) {
      throw new Error("Missing key : address");
    }

    const siweMessage = new SiweMessage(message);
    const lowerCaseAddress = siweMessage.address.toLowerCase();

    if (siweMessage.address.toLowerCase() !== address.toLowerCase()) {
      throw new Error("Address mismatch in provided address and message");
    }

    const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_CLIENT_API_KEY!);

    // get nonce from db, if its null that means it was alrd used
    const { error: nonceError, data: nonceData } = await supabase
      .from("user-nonce")
      .select("nonce")
      .eq("address", lowerCaseAddress)
      .single();

    if (nonceError || !nonceData?.nonce) {
      throw new Error("Unable to fetch nonce from DB");
    }

    try {
      await siweMessage.verify({ signature, nonce: nonceData.nonce, time: new Date().toISOString() });
    } catch (err) {
      throw new Error("Invalid signer");
    }

    const { error } = await supabase.from("user-nonce").delete().match({ address: lowerCaseAddress });

    if (error) {
      throw new Error("Error updating nonce in DB");
    }

    const issuer = process.env.JWT_ISSUER ?? "Kleros"; // ex :- Kleros
    const audience = process.env.JWT_AUDIENCE ?? "Court"; // ex :- Court, Curate, Escrow
    const authExp = process.env.JWT_EXP_TIME ?? "2h";
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("Secret not set in environment");
    }
    // user verified, generate auth token
    const encodedSecret = new TextEncoder().encode(secret);

    const token = await new jwt.SignJWT({ id: address.toLowerCase() })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime(authExp)
      .sign(encodedSecret);

    return { statusCode: 200, body: JSON.stringify({ message: "User authorised", token }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: `${err}` }) };
  }
};

export const handler = middy(authUser).use(jsonBodyParser());
