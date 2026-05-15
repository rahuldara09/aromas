import { Order, OrderStatus } from '@/types';

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending_payment':
      return 'Payment pending';
    case 'payment_processing':
      return 'Payment processing';
    case 'failed':
      return 'Payment failed';
    case 'Dispatched':
      return 'Out for delivery';
    case 'Completed':
      return 'Ready';
    default:
      return status;
  }
}

export function isOrderActiveStatus(status: OrderStatus): boolean {
  return ['Placed', 'Pending', 'Preparing', 'Dispatched'].includes(status);
}

export function isOrderCompletedStatus(status: OrderStatus): boolean {
  return ['Delivered', 'Completed'].includes(status);
}

export function getOrderAgeMinutes(order: Order): number {
  const start =
    order.timeline?.accepted ||
    order.timeline?.preparing ||
    order.orderDate;

  return Math.max(
    0,
    Math.floor((Date.now() - new Date(start).getTime()) / 60_000)
  );
}

export function getOrderSlaState(order: Order): 'normal' | 'warning' | 'overdue' {
  const mins = getOrderAgeMinutes(order);
  if (mins >= 30) return 'overdue';
  if (mins >= 20) return 'warning';
  return 'normal';
}
