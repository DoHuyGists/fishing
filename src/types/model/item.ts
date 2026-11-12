export interface ShopItem {
  id: string;
  category: string | null;
  classification: string | null;
  name: string;
  information: string;
  image: string | null;
  icon: string | null;
  quantity: number | null;
  price: number;
  rpc: string | null;
}

export interface Item {
  id: string;
  category: string | null;
  name: string;
  information: string;
  image: string | null;
  icon: string | null;
  price: number;
}
