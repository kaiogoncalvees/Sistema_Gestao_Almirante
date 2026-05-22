import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { CSVImport } from '@/components/forms/CSVImport';

const formSchema = z.object({
  credor: z.string().min(2, 'Credor é obrigatório'),
  descricao: z.string().optional(),
  valor: z.string().min(1, 'Valor é obrigatório'),
  data_vencimento: z.date({ required_error: 'Data de vencimento é obrigatória' }),
  data_programacao: z.date().optional(),
  categoria: z.string().optional(),
  centro_custo: z.string().min(1, 'Centro de custo é obrigatório'),
  forma_pagamento: z.string().optional(),
  status: z.string().min(1, 'Status é obrigatório'),
  pix_codigo: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const categorias = [
  'Materiais para Revenda',
  'Despesas Operacionais',
  'Folha de Pagamento',
  'Impostos e Taxas',
  'Serviços Terceirizados',
  'Manutenção',
  'Marketing',
  'Outros',
];

const centrosCusto = ['Ilha', 'Tropical'];

const formasPagamento = [
  'PIX',
  'Transferência Bancária',
  'Boleto',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro',
];

const statusOptions = [
  'Pendente',
  'Programado',
  'A vencer',
  'Pago',
  'Atrasado',
  'A Programar',
];

const Cadastrar = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('manual');
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      credor: '',
      descricao: '',
      valor: '',
      categoria: '',
      centro_custo: '',
      forma_pagamento: '',
      status: 'Pendente',
      pix_codigo: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const valorNumerico = parseFloat(data.valor.replace(/[^\d,.-]/g, '').replace(',', '.'));
      
      const { error } = await supabase.from('contas_a_pagar').insert({
        credor: data.credor,
        descricao: data.descricao || null,
        valor: valorNumerico,
        data_vencimento: format(data.data_vencimento, 'yyyy-MM-dd'),
        data_programacao: data.data_programacao
          ? format(data.data_programacao, 'yyyy-MM-dd')
          : null,
        categoria: data.categoria || null,
        centro_custo: data.centro_custo,
        forma_pagamento: data.forma_pagamento || null,
        status: data.status,
        pix_codigo: data.pix_codigo || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conta cadastrada com sucesso!');
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['accountsPayable'] });
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar conta', {
        description: error.message,
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Cadastrar Conta</h1>
          <p className="text-sm text-muted-foreground">Adicione novas contas manualmente ou importe em massa</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="manual" className="min-h-[44px]">
              <Plus className="w-4 h-4 mr-2" />
              Cadastro Manual
            </TabsTrigger>
            <TabsTrigger value="import" className="min-h-[44px]">
              <Upload className="w-4 h-4 mr-2" />
              Importar CSV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <div className="chart-container">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Credor */}
                  <FormField
                    control={form.control}
                    name="credor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credor / Fornecedor *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do credor" {...field} className="min-h-[44px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Descrição */}
                  <FormField
                    control={form.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descrição da conta"
                            {...field}
                            className="min-h-[80px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Valor e Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="valor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="R$ 0,00"
                              {...field}
                              className="min-h-[44px]"
                            />
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
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Datas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="data_vencimento"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de Vencimento *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'min-h-[44px] w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value
                                    ? format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                    : 'Selecione uma data'}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                locale={ptBR}
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_programacao"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de Programação</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'min-h-[44px] w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value
                                    ? format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                    : 'Selecione uma data'}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                locale={ptBR}
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Categoria e Centro de Custo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="categoria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categorias.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
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
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {centrosCusto.map((cc) => (
                                <SelectItem key={cc} value={cc}>
                                  {cc}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Forma de Pagamento e PIX */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="forma_pagamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forma de Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {formasPagamento.map((fp) => (
                                <SelectItem key={fp} value={fp}>
                                  {fp}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pix_codigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código PIX</FormLabel>
                          <FormControl>
                            <Input placeholder="Chave PIX ou código" {...field} className="min-h-[44px]" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full min-h-[48px] text-base font-semibold"
                  >
                    {mutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-5 h-5 mr-2" />
                    )}
                    Cadastrar Conta
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>

          <TabsContent value="import">
            <div className="chart-container">
              <h3 className="text-lg font-semibold text-foreground mb-4">Importar Dados em Massa</h3>
              <CSVImport onClose={() => setActiveTab('manual')} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Cadastrar;
