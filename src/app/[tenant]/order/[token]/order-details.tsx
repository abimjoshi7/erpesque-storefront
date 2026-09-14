import type { ReactNode } from "react";

import { Card, Icon, StatusPill, Text } from "@/design-system";
import type { OrderStatus } from "@/lib/erp";
import { formatPrice } from "@/lib/money";
import { formatOrderDate, statusCopy } from "@/lib/order-status";

/**
 * One order, described.
 *
 * Rendered by both the status page a guest reaches with their token and the
 * account order page a signed-in buyer reaches with an order number. They show
 * the same order and must describe it the same way, so there is one markup for
 * it rather than two copies that drift.
 *
 * `aside` is for what differs between the two — the guest page's cancel
 * control — and sits under the delivery details, beside the lines.
 */
export function OrderDetails({
  order,
  orderNumber,
  aside,
}: {
  order: OrderStatus;
  /** What to call the order when the ERP's copy has no number on it. */
  orderNumber: string;
  aside?: ReactNode;
}) {
  const currency = order.currency;
  const copy = statusCopy(order.status);

  return (
    <>
      <Text as="h1" variant="display" className="mt-4">
        Order {order.orderNumber ?? orderNumber}
      </Text>
      {order.orderDate ? (
        <Text variant="bodyMedium" tone="muted" className="mt-2">
          Placed {formatOrderDate(order.orderDate)}
        </Text>
      ) : null}

      <Card className="mt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <StatusPill tone={copy.tone} className="self-start sm:self-auto">
            {copy.label}
          </StatusPill>
          <Text variant="bodyLarge" tone="subdued">
            {copy.detail}
          </Text>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card
          padding={false}
          header={
            <Text as="h2" variant="headlineMedium">
              What you ordered
            </Text>
          }
        >
          <ul className="divide-y divide-line">
            {order.lines.map((line, index) => (
              <li
                key={index}
                className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {line.quantity !== undefined ? (
                    <span className="mt-px inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-sm bg-surface-subdued px-1.5 text-caption font-semibold text-ink-subdued tabular-nums">
                      {line.quantity}×
                    </span>
                  ) : null}
                  <span className="text-body text-ink-strong">{line.title}</span>
                </div>
                <span className="shrink-0 text-body tabular-nums">
                  {currency ? formatPrice(line.lineTotalMinor ?? 0, currency) : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-4 sm:px-5">
            <p className="flex items-baseline justify-between gap-4 text-ink-strong">
              <span className="text-title font-semibold">Total</span>
              <span className="text-h3 font-bold tabular-nums">
                {currency ? formatPrice(order.totalMinor, currency) : null}
              </span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-caption text-ink-muted">
              <Icon name="cash" className="size-4" />
              Payment is on delivery.
            </p>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card
            header={
              <div className="flex items-center gap-2">
                <Icon name="truck" className="size-4.5 text-ink-muted" />
                <Text as="h2" variant="headlineMedium">
                  Delivering to
                </Text>
              </div>
            }
          >
            <div className="text-body-sm text-ink">
              <p className="font-semibold text-ink-strong">{order.contactName}</p>
              <p className="mt-1">{order.deliveryAddress}</p>
              {order.deliveryLandmark ? (
                <p className="text-ink-muted">{order.deliveryLandmark}</p>
              ) : null}
              {order.note ? (
                <p className="mt-3 border-t border-line pt-3 text-ink-muted italic">
                  “{order.note}”
                </p>
              ) : null}
            </div>
          </Card>

          {aside}
        </div>
      </div>
    </>
  );
}
