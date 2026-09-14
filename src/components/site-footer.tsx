import Link from "next/link";
import type { ReactNode } from "react";

import { shopShortcuts } from "@/components/shop-shortcuts";
import { ShopWordmark } from "@/components/shop-wordmark";
import { Container, Icon, Text, type IconName } from "@/design-system";

/**
 * The foot of every page of a shop.
 *
 * Everything said here is something the platform actually guarantees — payment
 * on delivery, prices checked at checkout. Sign-in by code is left out because
 * it is not universal: a shop whose `signInWith` is empty cannot send one, and
 * this footer renders from the layout's hour-old tenant. The usual footer
 * promises (free returns, secure payment badges, a support line) are the
 * merchant's to make, and the ERP does not tell us any of them, so a footer
 * that printed them would be inventing policy on a shop's behalf.
 *
 * No shelves. The header's menu already holds every one of them on every page,
 * and a second, shorter list down here only repeated it. The "Shop" column
 * carries the same shortcuts the header does instead, which are the ways in a
 * shopper who has scrolled to the bottom is most likely to want next.
 */
export function SiteFooter({
  tenant,
  shopName,
  currencyCode,
}: {
  tenant: string;
  shopName: string;
  currencyCode?: string | null;
}) {
  const home = `/${encodeURIComponent(tenant)}`;

  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <Container className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 lg:grid-cols-12 lg:gap-8">
        <div className="col-span-2 lg:col-span-4">
          <Link href={home} className="inline-flex rounded-md" aria-label={`${shopName} home`}>
            <ShopWordmark name={shopName} />
          </Link>
          <Text tone="subdued" className="mt-4 max-w-xs">
            Browse {shopName}&rsquo;s shelves online and order in a few taps.
          </Text>
        </div>

        <FooterColumn heading="Shop" className="lg:col-span-2">
          <FooterLink href={home}>All products</FooterLink>
          {shopShortcuts(tenant).map((shortcut) => (
            <FooterLink key={shortcut.href} href={shortcut.href}>
              {shortcut.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn heading="Your account" className="lg:col-span-2">
          <FooterLink href={`${home}/account`}>Orders &amp; account</FooterLink>
          <FooterLink href={`${home}/sign-in`}>Sign in</FooterLink>
          <FooterLink href={`${home}/cart`}>Cart</FooterLink>
        </FooterColumn>

        <div className="col-span-2 lg:col-span-4">
          <FooterHeading>Good to know</FooterHeading>
          <ul className="mt-4 flex flex-col gap-4">
            <Assurance icon="cash" title="Payment on delivery">
              Nothing is charged online. You pay when your order arrives.
            </Assurance>
            <Assurance icon="check" title="Today’s prices">
              Checkout prices your cart against the shop&rsquo;s live catalog.
            </Assurance>
          </ul>
        </div>
      </Container>

      <div className="border-t border-line">
        <Container className="flex flex-col gap-1 py-6 text-caption text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {shopName}
          </p>
          {currencyCode ? <p>Prices in {currencyCode}</p> : null}
        </Container>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: ReactNode }) {
  return (
    <Text as="h2" variant="labelMedium" tone="strong">
      {children}
    </Text>
  );
}

function FooterColumn({
  heading,
  className,
  children,
}: {
  heading: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <FooterHeading>{heading}</FooterHeading>
      <ul className="mt-4 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-body-sm text-ink-subdued transition-colors duration-(--duration-fast) ease-standard hover:text-ink-strong"
      >
        {children}
      </Link>
    </li>
  );
}

function Assurance({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-subdued text-ink-subdued">
        <Icon name={icon} className="size-[1.125rem]" />
      </span>
      <div>
        <Text variant="labelMedium" tone="strong">
          {title}
        </Text>
        <Text variant="bodySmall" tone="subdued" className="mt-0.5">
          {children}
        </Text>
      </div>
    </li>
  );
}
