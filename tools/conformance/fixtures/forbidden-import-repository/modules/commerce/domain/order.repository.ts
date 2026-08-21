export interface OrderRepository {
  findById(id: string): unknown;
}
