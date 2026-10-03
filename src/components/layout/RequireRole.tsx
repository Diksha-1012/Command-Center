import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useNexus } from "@/store/DataContext";
import { canAccess, homeFor, ROLE_BY_ID } from "@/lib/roles";

/**
 * ROUTE-LEVEL ROLE ENFORCEMENT
 * ======================================================================
 * The sidebar already filters navigation by role; this guard makes the
 * restriction real — a role that types a URL it does not own is redirected to
 * its home route instead of rendering the page.
 */
export function RequireRole({ children }: { children: ReactNode }) {
  const { role } = useNexus();
  const { pathname } = useLocation();
  const def = ROLE_BY_ID[role];

  if (!canAccess(def, pathname)) {
    return <Navigate to={homeFor(def)} replace />;
  }
  return <>{children}</>;
}
