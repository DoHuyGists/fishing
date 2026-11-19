export interface Pt {
  x: number
  y: number
}

export interface Zone {
  id: string
  name: string
  note: string
  color: string
  seed: Pt // node dời vùng
  r: number // bán kính ảnh hưởng: càng lớn vùng càng rộng
  ang: number // góc của node kéo giãn (chỉ để hiển thị)
}

export type ShapeKey = 'natural' | 'ellipse' | 'circle' | 'rect' | 'square' | 'round' | 'hex'
export type DragKind = 'seed' | 'radius' | 'lakeW' | 'lakeH' | 'lakeNode'
