import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { CENTROS_CUSTO } from '@/config/centros';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { criarConta, ContaFormData } from '@/services/contasAPagar';

interface Props {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const CATEGORIAS = [
  'Aluguel', 'Fornecedor', 'Folha de Pagamento', 'Impostos', 'Serviços',
  'Manutenção', 'Marketing', 'Transporte', 'Alimentação', 'Outros',
];

const CONTAS = [
  'Bradesco SM', 'Bradesco SA', 'Stone SA', 'Stone SM',
  'Conta Cartão SA', 'PagBank SA', 'PagBank SM',
];

const FREQUENCIAS = [
  { value: 'semanal',    label: 'Semanal'    },
  { value: 'quinzenal',  label: 'Quinzenal'  },
  { value: 'mensal',     label: 'Mensal'     },
  { value: 'bimestral',  label: 'Bimestral'  },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral',  label: 'Semestral'  },
  { value: 'anual',      label: 'Anual'      },
];

export const NovaContaDialog = ({ trigger, onSuccess }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [recorrente, setRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState('mensal');
  const [categoria, setCategoria] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [contaBancaria, setContaBancaria] = useState('');

  const { toast } = useToast();
  const qc = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    descricao: string;
    credor: string;
    valor: string;
    observacao: string;
  }>();

  const handleClose = () => {
    setOpen(false);
    reset();
    setDataVencimento(undefined);
    setDataFim(undefined);
    setRecorrente(false);
    setFrequencia('mensal');
    setCategoria('');
    setCentroCusto('');
    setContaBancaria('');
  };

  const onSubmit = async (fields: { descricao: string; credor: string; valor: string; observacao: string }) => {
    if (!dataVencimento) {
      toast({ title: 'Informe a data de vencimento', variant: 'destructive' });
      return;
    }

    const valor = parseFloat(fields.valor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }

    const formData: ContaFormData = {
      descricao:     fields.descricao,
      credor:        fields.credor,
      valor,
      dataVencimento,
      status:        'Pendente',
      categoria,
      centroCusto,
      contaBancaria,
      observacao:    fields.observacao,
      recorrente,
      frequencia:    recorrente ? frequencia : undefined,
      dataFim:       recorrente && dataFim ? dataFim : null,
    };

    setLoading(true);
    try {
      await criarConta(formData);
      qc.invalidateQueries({ queryKey: ['contas-a-pagar'] });
      toast({ title: recorrente ? 'Contas recorrentes criadas!' : 'Conta criada!' });
      handleClose();
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button>Nova Conta</Button>}
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Conta a Pagar</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Descrição */}
          <div className="space-y-1">
            <Label>Descrição *</Label>
            <Input placeholder="Ex: Aluguel Janeiro" {...register('descricao', { required: true })} />
            {errors.descricao && <p className="text-xs text-destructive">Obrigatório</p>}
          </div>

          {/* Credor */}
          <div className="space-y-1">
            <Label>Credor / Fornecedor</Label>
            <Input placeholder="Nome do credor" {...register('credor')} />
          </div>

          {/* Valor + Data de vencimento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor (R$) *</Label>
              <Input
                placeholder="0,00"
                inputMode="decimal"
                {...register('valor', { required: true })}
              />
              {errors.valor && <p className="text-xs text-destructive">Obrigatório</p>}
            </div>

            <div className="space-y-1">
              <Label>Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dataVencimento && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVencimento ? format(dataVencimento, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataVencimento} onSelect={setDataVencimento} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Categoria + Centro */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Centro de Custo</Label>
              <Select value={centroCusto} onValueChange={setCentroCusto}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {CENTROS_CUSTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conta Bancária */}
          <div className="space-y-1">
            <Label>Conta Bancária</Label>
            <Select value={contaBancaria} onValueChange={setContaBancaria}>
              <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
              <SelectContent>
                {CONTAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea placeholder="Observações opcionais..." rows={2} {...register('observacao')} />
          </div>

          {/* Recorrente toggle */}
          <div className="flex items-center gap-3 py-1">
            <Switch id="recorrente" checked={recorrente} onCheckedChange={setRecorrente} />
            <Label htmlFor="recorrente" className="cursor-pointer">Conta recorrente</Label>
          </div>

          {/* Frequência + Data fim (só se recorrente) */}
          {recorrente && (
            <div className="grid grid-cols-2 gap-3 pl-1 border-l-2 border-primary/30">
              <div className="space-y-1">
                <Label>Frequência</Label>
                <Select value={frequencia} onValueChange={setFrequencia}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Encerrar em (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal text-sm', !dataFim && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataFim ? format(dataFim, 'dd/MM/yyyy') : 'Sem fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataFim} onSelect={setDataFim} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Salvando...' : recorrente ? 'Criar Série' : 'Criar Conta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
