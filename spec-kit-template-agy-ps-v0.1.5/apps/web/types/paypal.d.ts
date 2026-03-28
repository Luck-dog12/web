type PaypalButtonsCreateOrderData = {
  orderID?: string;
};

type PaypalButtonsOnApproveData = {
  orderID?: string;
};

type PaypalButtonsComponent = {
  render: (selector: string) => Promise<void>;
};

type PaypalButtonsOptions = {
  createOrder: (data: PaypalButtonsCreateOrderData) => Promise<string> | string;
  onApprove: (data: PaypalButtonsOnApproveData) => Promise<void> | void;
  onError?: (error: unknown) => void;
};

type PaypalNamespace = {
  Buttons: (options: PaypalButtonsOptions) => PaypalButtonsComponent;
};

interface Window {
  paypal?: PaypalNamespace;
}
