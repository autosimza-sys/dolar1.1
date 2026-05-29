"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { demoEducationCards, demoRates } from "@/lib/demo-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EducationCard, FavoriteRate, Profile, Rate, Subscription, UserAlert } from "@/lib/types";

type LoadState<T> = {
  data: T;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useSupabase() {
  return useMemo(() => createSupabaseBrowserClient(), []);
}

export function useRates(): LoadState<Rate[]> {
  const supabase = useSupabase();
  const [data, setData] = useState<Rate[]>(demoRates);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) {
      setData(demoRates);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: rows, error: queryError } = await supabase
      .from("rates")
      .select("*")
      .eq("is_visible", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setData(demoRates);
    } else {
      setError(null);
      setData(rows?.length ? (rows as Rate[]) : demoRates);
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}

export function useEducationCards(): LoadState<EducationCard[]> {
  const supabase = useSupabase();
  const [data, setData] = useState<EducationCard[]>(demoEducationCards);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) {
      setData(demoEducationCards);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: rows, error: queryError } = await supabase
      .from("education_cards")
      .select("*")
      .eq("is_visible", true)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setData(demoEducationCards);
    } else {
      setError(null);
      setData(rows?.length ? (rows as EducationCard[]) : demoEducationCards);
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}

export function useAccount() {
  const supabase = useSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRate[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  const loadUserData = useCallback(
    async (activeUser: User | null) => {
      if (!supabase || !activeUser) {
        setProfile(null);
        setSubscription(null);
        setAlerts([]);
        setFavorites([]);
        return;
      }

      const [{ data: profileRow }, { data: subscriptionRows }, { data: alertRows }, { data: favoriteRows }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", activeUser.id).maybeSingle(),
          supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", activeUser.id)
            .order("started_at", { ascending: false }),
          supabase.from("alerts").select("*").eq("user_id", activeUser.id).order("created_at", { ascending: false }),
          supabase.from("favorite_rates").select("*").eq("user_id", activeUser.id).order("created_at", { ascending: false })
        ]);

      setProfile((profileRow as Profile | null) ?? null);
      setSubscription(((subscriptionRows?.[0] as Subscription | undefined) ?? null) as Subscription | null);
      setAlerts((alertRows as UserAlert[] | null) ?? []);
      setFavorites((favoriteRows as FavoriteRate[] | null) ?? []);
    },
    [supabase]
  );

  const reload = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    await loadUserData(data.session?.user ?? null);
    setIsLoading(false);
  }, [loadUserData, supabase]);

  useEffect(() => {
    if (!supabase) return;

    void reload();
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        event === "PASSWORD_RECOVERY" &&
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/reset-password")
      ) {
        const recoveryParams = window.location.hash || window.location.search || "";
        window.location.replace(`/reset-password${recoveryParams}`);
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void loadUserData(nextSession?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [loadUserData, reload, supabase]);

  return {
    supabase,
    session,
    user,
    profile,
    subscription,
    alerts,
    favorites,
    isLoading,
    isPremium: Boolean(profile?.is_premium || subscription?.status === "active"),
    reload
  };
}

export function getAdminEmails() {
  const defaultAdminEmails = ["autosimza@gmail.com", "admin@dolarmendoza.app"];
  const configured = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured.length ? configured : defaultAdminEmails;
}
