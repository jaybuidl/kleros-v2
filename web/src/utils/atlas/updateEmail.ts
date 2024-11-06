import { GraphQLError } from "graphql";
import { gql, type GraphQLClient } from "graphql-request";
import { toast } from "react-toastify";

import { OPTIONS } from "utils/wrapWithToast";

const query = gql`
  mutation UpdateEmail($newEmail: String!) {
    updateEmail(newEmail: $newEmail)
  }
`;

export type UpdateEmailData = {
  newEmail: string;
};

type UpdateEmailResponse = {
  updateEmail: boolean;
};

export function updateEmail(client: GraphQLClient, userData: UpdateEmailData): Promise<boolean> {
  const variables = userData;

  return toast.promise<boolean, Error>(
    client
      .request<UpdateEmailResponse>(query, variables)
      .then(async (response) => response.updateEmail)
      .catch((errors) => {
        // eslint-disable-next-line no-console
        console.log("Update Email error:", { errors });

        const error = errors?.response?.errors?.[0];

        if (error) {
          throw new GraphQLError(error?.message, { ...error });
        }
        throw new Error("Unknown Error");
      }),
    {
      pending: `Updating Email ...`,
      success: "Email Updated successfully!",
      error: {
        render({ data: error }) {
          return `Updating Email failed: ${error?.message}`;
        },
      },
    },
    OPTIONS
  );
}
