export interface ItemRow {
  id: string;
  createdAt: string;
  category: string;
  name: string;
  information: string;
  image: string;
  updatedAt: string;
  isDisabled: boolean;
}

export interface AdminItemRow {
  id: string;
  createdAt: string;
  category: string | null;
  name: string;
  information: string;
  image: string | null;
  updatedAt: string | null;
  isDisabled: boolean | null;
  icon: string | null;
  classification: string | null;
  quantity: number | null;
  price: number;
  rpc: string | null;
}

export interface ItemPayload {
  category: string | null;
  name: string;
  information: string;
  image: string | null;
  isDisabled: boolean;
  icon: string | null;
  classification: string | null;
  quantity: number | null;
  price: number;
  rpc: string | null;
}
