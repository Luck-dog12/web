type PaypalButtonsCreateOrderData = {
  orderID?: string;
};

type PaypalButtonsOnApproveData = {
  orderID?: string;
  payerID?: string;
};

type PaypalButtonsOnCancelData = {
  orderID?: string;
};

type PaypalButtonsActions = {
  disable: () => void;
  enable: () => void;
};

type PaypalButtonsStyle = {
  layout?: 'vertical' | 'horizontal';
  shape?: 'rect' | 'pill';
  label?: 'paypal' | 'checkout' | 'pay' | 'buynow' | 'installment';
  tagline?: boolean;
};

type PaypalButtonsComponent = {
  render: (selector: string) => Promise<void>;
};

type PaypalButtonsOptions = {
  createOrder: (data: PaypalButtonsCreateOrderData) => Promise<string> | string;
  onApprove: (data: PaypalButtonsOnApproveData) => Promise<void> | void;
  onCancel?: (data: PaypalButtonsOnCancelData) => Promise<void> | void;
  onError?: (error: unknown) => void;
  onInit?: (data: unknown, actions: PaypalButtonsActions) => void;
  style?: PaypalButtonsStyle;
};

type PaypalNamespace = {
  Buttons: (options: PaypalButtonsOptions) => PaypalButtonsComponent;
};

interface Window {
  paypal?: PaypalNamespace;
}
