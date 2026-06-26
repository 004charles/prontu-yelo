import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useOpsStore } from "../lib/ops-store";
import { OpsShell } from "../components/ops/OpsShell";
import { getSettingsServer, saveSettingsServer } from "../lib/ops.functions";
import { supabase } from "../lib/supabase";
import {
  Users,
  UserPlus,
  Key,
  Trash2,
  Shield,
  UserCheck,
  ArrowLeftRight,
  ShieldAlert,
  Lock,
  Save,
  RefreshCw,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administração · Tupuca × Prontu" },
      { name: "description", content: "Administração de operadores, permissões e chaves de API." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const store = useOpsStore();
  const {
    jwt,
    isAdmin,
    operators,
    fetchOperators,
    createOperator,
    updateOperatorRole,
    deleteOperator,
  } = store;

  const [activeTab, setActiveTab] = useState<"operators" | "settings">("operators");
  const [prontuKey, setProntuKey] = useState("");
  const [yeloKey, setYeloKey] = useState("");
  const [yeloMarketplaceUserId, setYeloMarketplaceUserId] = useState("");
  const [yeloVendorId, setYeloVendorId] = useState("1");
  const [yeloPaymentMethodId, setYeloPaymentMethodId] = useState("8");
  const [savingSettings, setSavingSettings] = useState(false);

  // New operator form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ops" | "admin">("ops");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check auth and permissions
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        toast.error("Por favor, inicie sessão.");
        navigate({ to: "/auth" });
      } else {
        // Initialize store if not done
        if (!jwt) {
          await store.initialize(session.access_token);
        }
        setLoading(false);
      }
    });
  }, [navigate, jwt]);

  // Access control check once initialization completed
  useEffect(() => {
    if (!loading && !isAdmin) {
      toast.error("Acesso negado: Apenas administradores podem aceder a esta área.");
      navigate({ to: "/" });
    }
  }, [loading, isAdmin, navigate]);

  // Load operators list and settings
  useEffect(() => {
    if (jwt && isAdmin) {
      fetchOperators();

      getSettingsServer({ data: { jwt } })
        .then((settings) => {
          setProntuKey(settings.prontuKey);
          setYeloKey(settings.yeloKey);
          setYeloMarketplaceUserId(settings.yeloMarketplaceUserId || "");
          setYeloVendorId(settings.yeloVendorId || "1");
          setYeloPaymentMethodId(settings.yeloPaymentMethodId || "8");
        })
        .catch((err) => {
          console.error("Failed to load settings:", err);
          toast.error(
            "Aviso: Não foi possível obter as credenciais atualizadas do servidor. Usando dados locais.",
          );
        });
    }
  }, [jwt, isAdmin]);

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setCreating(true);
    try {
      await createOperator(email, role, password);
      toast.success(`Operador ${email} registado com sucesso!`);
      setEmail("");
      setPassword("");
      setRole("ops");
    } catch (err: any) {
      toast.error(err.message || "Falha ao criar operador.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: "admin" | "ops") => {
    const nextRole = currentRole === "admin" ? "ops" : "admin";
    try {
      await updateOperatorRole(userId, nextRole);
      toast.success("Cargo do operador atualizado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar cargo.");
    }
  };

  const handleDeleteOperator = async (userId: string, emailStr: string) => {
    if (!confirm(`Tem a certeza que deseja eliminar o operador ${emailStr}?`)) {
      return;
    }

    try {
      await deleteOperator(userId);
      toast.success(`Operador ${emailStr} removido do sistema.`);
    } catch (err: any) {
      toast.error(err.message || "Falha ao remover operador.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveSettingsServer({
        data: {
          prontuKey,
          yeloKey,
          yeloMarketplaceUserId,
          yeloVendorId,
          yeloPaymentMethodId,
          jwt: jwt || undefined,
        },
      });
      toast.success("Configurações gravadas com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao guardar configurações.");
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-mono">A verificar permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <OpsShell>
      <div className="bg-grid border-b border-border/40">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-mono flex items-center gap-1.5">
              <Shield className="size-3" /> Painel de Controlo
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Administração do Sistema</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Faça a gestão de operadores da sala de operações, ajuste credenciais de APIs e
              visualize a matriz de privilégios.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex border-b border-border/40 gap-4">
            <button
              onClick={() => setActiveTab("operators")}
              className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "operators"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-4" />
              Operadores da Sala ({operators.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "settings"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Key className="size-4" />
              Credenciais e APIs
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {activeTab === "operators" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Operator List Table */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur-md overflow-hidden">
                <div className="p-4 border-b border-border/40 flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    Operadores Registados
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/20 bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                        <th className="p-4">Utilizador / E-mail</th>
                        <th className="p-4">Cargo</th>
                        <th className="p-4">Registado Em</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 text-xs">
                      {operators.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-8 text-center text-muted-foreground font-mono"
                          >
                            Nenhum operador registado.
                          </td>
                        </tr>
                      ) : (
                        operators.map((op) => (
                          <tr key={op.id} className="hover:bg-accent/15 transition-colors">
                            <td className="p-4 font-medium flex items-center gap-2">
                              <span className="size-2 rounded-full bg-success/80" />
                              {op.email}
                            </td>
                            <td className="p-4">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  op.role === "admin"
                                    ? "bg-warning/10 text-warning border border-warning/20"
                                    : "bg-primary/10 text-primary border border-primary/20"
                                }`}
                              >
                                {op.role === "admin" ? "Administrador" : "Operador (OPS)"}
                              </span>
                            </td>
                            <td className="p-4 text-muted-foreground font-mono">
                              {new Date(op.created_at).toLocaleDateString("pt-PT")}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Alternar Cargo"
                                onClick={() => handleToggleRole(op.id, op.role)}
                                className="size-8 p-0 border border-border/40 hover:bg-primary/10 hover:text-primary"
                              >
                                <ArrowLeftRight className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Eliminar Operador"
                                onClick={() => handleDeleteOperator(op.id, op.email)}
                                className="size-8 p-0 border border-border/40 hover:bg-critical/10 hover:text-critical"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Security info card */}
              <div className="p-5 rounded-lg border border-warning/20 bg-warning/5 text-xs text-warning/90 flex gap-3">
                <ShieldAlert className="size-5 shrink-0 text-warning mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-warning">Regras de Atribuição Automática</div>
                  <p className="leading-relaxed">
                    O primeiro utilizador a registar-se na plataforma é automaticamente promovido a
                    administrador. Todos os operadores registados subsequentemente pelo formulário
                    ou painel Auth recebem por defeito o perfil limitado de operador (
                    <code className="font-mono bg-warning/10 px-1 rounded">ops</code>).
                  </p>
                </div>
              </div>
            </div>

            {/* Create Operator Form */}
            <div className="space-y-6">
              <div className="p-6 rounded-lg border border-border/40 bg-card/40 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">Novo Operador</h3>
                </div>

                <form onSubmit={handleCreateOperator} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail Corporativo</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="operador@tupuca.ao"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-surface-2 border-border/60 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Palavra-passe Inicial</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      placeholder="Mínimo 6 caracteres..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-surface-2 border-border/60 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="role">Cargo / Nível de Acesso</Label>
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="flex h-9 w-full rounded-md border border-border/60 bg-surface-2 px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="ops">Operador Sala OPS (Restrito)</option>
                      <option value="admin">Administrador (Total)</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    disabled={creating}
                    className="w-full mt-2 gap-2 text-xs bg-primary text-primary-foreground"
                  >
                    <UserCheck className="size-3.5" />
                    {creating ? "A registar..." : "Registar Operador"}
                  </Button>
                </form>
              </div>

              {/* Permissions Matrix */}
              <div className="p-6 rounded-lg border border-border/40 bg-card/20 text-xs space-y-4">
                <h4 className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5" /> Matriz de Permissões
                </h4>
                <div className="space-y-3 font-mono text-[10px]">
                  <div className="pb-2 border-b border-border/20">
                    <div className="font-semibold text-warning">Administrador (admin)</div>
                    <div className="mt-1 text-muted-foreground">
                      - Visualização de painéis e métricas
                      <br />
                      - Reconciliação manual e automática
                      <br />
                      - Ações em incidentes (Criar pedidos, validar)
                      <br />
                      - Adição e remoção de operadores
                      <br />- Alteração de chaves de APIs
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-primary">Operador (ops)</div>
                    <div className="mt-1 text-muted-foreground">
                      - Visualização de painéis e métricas
                      <br />
                      - Reconciliação manual e automática
                      <br />
                      - Ações em incidentes (Criar pedidos, validar)
                      <br />- <span className="text-critical">Sem permissão</span> para chaves de
                      API
                      <br />- <span className="text-critical">Sem acesso</span> ao menu
                      Administração
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Tab settings: Global Configuration */
          <div className="max-w-2xl mx-auto p-6 rounded-lg border border-border/40 bg-card/40 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-6 border-b border-border/20 pb-4">
              <Key className="size-5 text-primary" />
              <div>
                <h3 className="font-semibold">Credenciais Globais de Conectores</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estas chaves são salvas de forma encriptada na base de dados e nunca são expostas
                  a operadores normais.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="prontu_key_admin">Chave de API Prontu (JWT Token)</Label>
                <Input
                  id="prontu_key_admin"
                  type="password"
                  placeholder="Introduza o Token JWT..."
                  value={prontuKey}
                  onChange={(e) => setProntuKey(e.target.value)}
                  className="bg-surface-2 border-border/60 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Token JWT necessário para as chamadas à API da Prontu de modo a puxar o histórico
                  de pagamentos confirmados.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="yelo_key_admin">Chave de API Yelo (API Key)</Label>
                <Input
                  id="yelo_key_admin"
                  type="password"
                  placeholder="Introduza a chave do Yelo (Jungleworks)..."
                  value={yeloKey}
                  onChange={(e) => setYeloKey(e.target.value)}
                  className="bg-surface-2 border-border/60 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Chave administrativa do marketplace Yelo (Tupuca) para criação automática ou
                  forçada de pedidos.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="yelo_marketplace_user_id_admin">
                  ID do Marketplace Yelo (marketplace_user_id / user_id)
                </Label>
                <Input
                  id="yelo_marketplace_user_id_admin"
                  type="text"
                  placeholder="Introduza o ID do Marketplace (User ID)..."
                  value={yeloMarketplaceUserId}
                  onChange={(e) => setYeloMarketplaceUserId(e.target.value)}
                  className="bg-surface-2 border-border/60 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  ID do Marketplace Yelo (Account/User ID) do Administrador/Parceiro, necessário
                  para listar pedidos.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="yelo_vendor_id_admin">ID do Vendedor Yelo (vendor_id)</Label>
                  <Input
                    id="yelo_vendor_id_admin"
                    type="text"
                    placeholder="Ex: 1"
                    value={yeloVendorId}
                    onChange={(e) => setYeloVendorId(e.target.value)}
                    className="bg-surface-2 border-border/60 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    ID padrão do vendedor (loja/restaurante) usado na criação de pedidos (Padrão:
                    1).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="yelo_payment_method_admin">ID do Método de Pagamento Yelo</Label>
                  <Input
                    id="yelo_payment_method_admin"
                    type="text"
                    placeholder="Ex: 8"
                    value={yeloPaymentMethodId}
                    onChange={(e) => setYeloPaymentMethodId(e.target.value)}
                    className="bg-surface-2 border-border/60 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    ID do método de pagamento customizado configurado no painel Yelo (Padrão: 8).
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/20 flex justify-end">
                <Button
                  type="submit"
                  disabled={savingSettings}
                  className="gap-2 bg-primary text-primary-foreground"
                >
                  <Save className="size-4" />
                  {savingSettings ? "A guardar chaves..." : "Guardar Credenciais"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </OpsShell>
  );
}
