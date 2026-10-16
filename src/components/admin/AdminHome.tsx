"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Account, SignIn } from "./SignIn";
import { EditView } from "./EditView";
import { ListView } from "./ListView";
import { useAuth } from "./useAuth";

export function AdminHome() {
  const auth = useAuth();
  const sp = useSearchParams();
  const router = useRouter();
  const [replacing, setReplacing] = useState(false);
  const view = sp.get("view");
  if (auth === undefined) return <div className="adm" />;
  const toList = () => {
    setReplacing(false);
    router.replace("/admin/");
  };
  if (!auth || replacing) return <SignIn onDone={toList} replacing={replacing && !!auth} />;
  if (view === "account") return <Account auth={auth} onReplace={() => setReplacing(true)} />;
  return <ListView auth={auth} />;
}

export function AdminEdit() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth === null) router.replace("/admin/");
  }, [auth, router]);
  if (!auth) return <div className="adm" />;
  return <EditView auth={auth} />;
}
