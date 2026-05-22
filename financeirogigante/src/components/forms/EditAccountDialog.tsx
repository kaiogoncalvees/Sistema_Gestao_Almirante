import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parse } from 'date-fns';
import { CalendarIcon, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { AccountsPayableEntry } from '@/types/accounts-payable';

const formSchema = z.object({
  credor: z.string().min(2, 'Credor é obrigatório'),
  descricao: z.string().optional(),
  valor: z.string().min(1, 'Valor é obrigatório'),
  data_vencimento: z.date({ required_error: 'Data de vencimento é obrigatória' }),
  data_programacao: z.date().optional().nullable(),
  categoria: z.string().optional(),
  centro_custo: z.string().min(1, 'Centro de custo é obrigatório'),
  forma_pagamento: z.string().optional(),
  status: z.string().min(1, 'Status é obrigatório'),
  pix_codigo: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditAccountDialogProps {
  account: (AccountsPayableEntry & { id: number }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export const EditAccountDialog = ({
  account,
  open,
  onOpenChange,
}: EditAccountDialogProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (account) {
      const [day, month, year] = account.dueDate.split('/');
      const dueDate = new Date(Number(year), Number(month) - 1, Number(day));
      
      let scheduleDate: Date | undefined;
      if (account.scheduleDate) {
        const [sDay, sMonth, sYear] = account.scheduleDate.split('/');
        scheduleDate = new Date(Number(sYear), Number(sMonth) - 1, Number(sDay));
      }

      form.reset({
        credor: account.creditor,
        descricao: account.description || '',
        valor: account.amount.toFixed(2).replace('.', ','),
        data_vencimento: dueDate,
        data_programacao: scheduleDate,
        categoria: account.category || '',
        centro_custo: account.costCenter,
        forma_pagamento: account.paymentMethod || '',
        status: account.status,
        pix_codigo: '',
      });
    }
  }, [account, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!account) throw new Error('Conta não encontrada');

      const valorNumerico = parseFloat(data.valor.replace(/[^\d,.-]/g, '').replace(',', '.'));

      const { error } = await supabase
        .from('contas_a_pagar')
        .update({
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
        })
        .eq('id', account.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conta atualizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['accountsPayable'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar conta', {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!account) throw new Error('Conta não encontrada');

      const { error } = await supabase
        .from('contas_a_pagar')
        .delete()
        .eq('id', account.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conta excluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['accountsPayable'] });
      onOpenChange(false);
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast.error('Erro ao excluir conta', {
        description: error.message,
      });
    },
  });

  const onSubmit = (data: FormData) => {
    updateMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Conta</DialogTitle>
            <DialogDescription>
              Atualize as informações da conta selecionada
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descrição" {...field} className="min-h-[60px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
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

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="data_vencimento"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Vencimento *</FormLabel>
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
                                : 'Selecione'}
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
                  name="centro_custo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Custo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                  name="forma_pagamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 min-h-[44px]"
                >
                  {updateMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
