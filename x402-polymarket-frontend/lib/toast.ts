import { toast, type ToastOptions } from 'react-toastify';

const defaultOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

export const showToast = {
  success: (message: string, options?: ToastOptions) => {
    toast.success(message, { ...defaultOptions, ...options });
  },

  error: (message: string, options?: ToastOptions) => {
    toast.error(message, { ...defaultOptions, ...options });
  },

  info: (message: string, options?: ToastOptions) => {
    toast.info(message, { ...defaultOptions, ...options });
  },

  warning: (message: string, options?: ToastOptions) => {
    toast.warning(message, { ...defaultOptions, ...options });
  },

  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, { ...defaultOptions, ...options });
  },

  update: (toastId: string | number, options: ToastOptions) => {
    toast.update(toastId, options);
  },

  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      pending: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ToastOptions
  ) => {
    return toast.promise(promise, messages, { ...defaultOptions, ...options });
  },
};

// Solana-specific toast helpers
export const solanaToast = {
  transactionSent: (signature: string) => {
    showToast.info(
      `Transaction sent! View on explorer`,
      {
        autoClose: 8000,
        onClick: () => {
          window.open(
            `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
            '_blank'
          );
        },
      }
    );
  },

  transactionConfirmed: (signature: string, message = 'Transaction confirmed!') => {
    showToast.success(message, {
      autoClose: 8000,
      onClick: () => {
        window.open(
          `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
          '_blank'
        );
      },
    });
  },

  transactionFailed: (error: string) => {
    showToast.error(`Transaction failed: ${error}`);
  },

  insufficientFunds: () => {
    showToast.error('Insufficient funds for this transaction');
  },

  walletNotConnected: () => {
    showToast.warning('Please connect your wallet first');
  },

  marketCreated: (signature: string) => {
    solanaToast.transactionConfirmed(signature, 'Market created successfully!');
  },

  liquidityAdded: (signature: string) => {
    solanaToast.transactionConfirmed(signature, 'Liquidity added successfully!');
  },

  swapCompleted: (signature: string) => {
    solanaToast.transactionConfirmed(signature, 'Swap completed successfully!');
  },
};
