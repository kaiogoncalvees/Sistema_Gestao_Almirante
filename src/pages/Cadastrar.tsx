import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, FileText, FileSpreadsheet, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { ImportarBoletos } from '@/components/importar/ImportarBoletos';
import { ImportarPlanilha } from '@/components/importar/ImportarPlanilha';

const formSchema = z.object({
  data_movimento: z.date({ required_error: 'Data da movimentação é obrigatória' }),
  credor: z.string().min(1, 'Credor é obrigatório'),
  descricao: z.string().optional(),
  tipo_operacao: z.enum(['Crédito', 'Débito']),
  conta_bancaria: z.string().optional(),
  valor: z.string().min(1, 'Valor é obrigatório'),
  status: z.string().optional(),
  categoria: z.string().optional(),
  centro_custo: z.string().min(1, 'Centro de custo é obrigatório'),
});

type FormData = z.infer<typeof formSchema>;

const categorias = [
  'Materiais para Revenda', 'Despesas Operacionais', 'Folha de Pagamento',
  'Impostos e Taxas', 'Serviços Terceirizados', 'Manutenção', 'Marketing', 'Outros',
];

const Cadastrar = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('boletos');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      credor: '', descricao: '', tipo_operacao: 'Débito',
      conta_bancaria: '', valor: '', status: '', categoria: '', centro_custo: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const valorAbs = parseFloat(data.valor.replace(/[^\d,.-]/g, '').replace(',', '.'));
      const valor = data.tipo_operacao === 'Débito' ? -Math.abs(valorAbs) : Math.abs(valorAbs);

      const { error } = await supabase.from('movimentacoes').insert({
        data_movimento:  format(data.data_movimento, 'yyyy-MM-dd'),
        credor:          data.credor,
        descricao:       data.descricao || '',
        tipo_operacao:   data.tipo_operacao,
        conta_bancaria:  data.conta_bancaria || '',
        valor,
        status:          data.status || '',
        categoria:       data.categoria || '',
        centro_custo:    data.centro_custo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Movimentação cadastrada com sucesso!');
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
    },
    onError: (error: unknown) => {
      toast.error('Erro ao cadastrar movimentação', { description: (error as Error).message });
    },
  });

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Importar</h1>
          <p className="text-sm text-muted-foreground">
            Importe boletos PDF, planilhas de contas a pagar ou lance movimentações manualmente
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="boletos" className="min-h-[44px] gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Boletos</span>
              <span className="sm:hidden">PDF</span>
            </TabsTrigger>
            <TabsTrigger value="planilha" className="min-h-[44px] gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Planilha Excel</span>
              <span className="sm:hidden">Excel</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="min-h-[44px] gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Lançamento Manual</span>
              <span className="sm:hidden">Manual</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Boletos PDF */}
          <TabsContent value="boletos">
            <div className="chart-container">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">Importar Boletos PDF</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Faça upload dos PDFs do DDA. O sistema extrai credor, valor e vencimento automaticamente
                  e usa a linha digitável para evitar duplicatas.
                </p>
              </div>
              <ImportarBoletos />
            </div>
          </TabsContent>

          {/* Tab: Planilha Excel */}
          <TabsContent value="planilha">
            <div className="chart-container">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">Importar Planilha de Contas</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Importe uma planilha .xlsx ou .csv com as contas a pagar. Duplicatas são detectadas
                  automaticamente pelo credor + valor + vencimento.
                </p>
              </div>
              <ImportarPlanilha />
            </div>
          </TabsContent>

          {/* Tab: Lançamento Manual de Movimentação */}
          <TabsContent value="manual">
            <div className="chart-container">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-foreground">Lançamento Manual</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Registre manualmente uma movimentação no extrato bancário.
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">

                  <FormField
                    control={form.control}
                    name="data_movimento"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data da Movimentação *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn('min-h-[44px] w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                              >
                                {field.value ? format(field.value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione uma data'}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ptBR} className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="credor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credor / Beneficiário *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do credor" {...field} className="min-h-[44px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Descrição da movimentação" {...field} className="min-h-[80px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tipo_operacao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Débito">Débito (Saída)</SelectItem>
                              <SelectItem value="Crédito">Crédito (Entrada)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="valor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor *</FormLabel>
                          <FormControl>
                            <Input placeholder="R$ 0,00" {...field} className="min-h-[44px]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="conta_bancaria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Conta Bancária</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Bradesco SM" {...field} className="min-h-[44px]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Conciliado" {...field} className="min-h-[44px]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="categoria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categorias.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="centro_custo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Centro de Custo *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Ilha">Ilha</SelectItem>
                              <SelectItem value="Tropical">Tropical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={mutation.isPending} className="w-full min-h-[48px] text-base font-semibold">
                    {mutation.isPending
                      ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Salvando...</>
                      : <><Plus className="w-5 h-5 mr-2" />Cadastrar Movimentação</>
                    }
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Cadastrar;
