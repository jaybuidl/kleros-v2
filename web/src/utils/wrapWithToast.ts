import { toast, ToastPosition, Theme } from "react-toastify";
import { WriteContractResult } from "wagmi/dist/actions";

export const OPTIONS = {
  position: "top-center" as ToastPosition,
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: "colored" as Theme,
};

export async function wrapWithToast(contractWrite: () => Promise<WriteContractResult>, publicClient: any) {
  toast.info("Transaction initiated", OPTIONS);
  const { hash } = await contractWrite();
  await publicClient
    .waitForTransactionReceipt({ hash, confirmations: 2 })
    .then(() => {
      toast.success("Transaction mined!", OPTIONS);
    })
    .catch((error) => {
      toast.error(error.message, OPTIONS);
    });
}
