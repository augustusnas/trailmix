import { Fragment } from "react";

/** At the biggest text sizes, addresses only fit by breaking after their dots, slashes and @. */
export function breakable(address: string) {
  return address.split(/(?<=[.@/])/).map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}
