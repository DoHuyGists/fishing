export interface CrudRepository<Row extends { id: string }, Payload> {
  fetchAll(): Promise<Row[]>;
  create(payload: Payload): Promise<Row>;
  update(id: string, payload: Payload): Promise<Row>;
  remove(id: string): Promise<void>;
}
