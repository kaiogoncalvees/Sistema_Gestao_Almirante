// ============================================================
//  CONFIGURAÇÕES — preencha antes de usar
// ============================================================
var SUPABASE_URL      = 'https://SEU_PROJECT.supabase.co';
var SUPABASE_SERVICE_KEY = 'SEU_SERVICE_ROLE_KEY'; // chave service_role (não anon)
var SHEET_ID          = '1YyELG9hRAlIeIiyFYur7vib1HI7fgeH8RQkEA8enEsc';
var TABLE             = 'movimentacoes';
var BATCH_SIZE        = 200; // linhas por lote de INSERT

// Abas que serão sincronizadas (mesma estrutura de 9 colunas)
var SHEET_NAMES = [
  'Extrato Bradesco SM',
  'Extrato Bradesco SA',
  'Extrato Stone SA',
  'Extrato Stone SM',
  'Conta Cartão SA',
  'PagBank SA',
  'PagBank SM',
];
// ============================================================

/**
 * Gatilho principal.
 * Configure um Time-based Trigger para chamar syncMovimentacoes()
 * a cada 1 hora (ou no intervalo desejado).
 */
function syncMovimentacoes() {
  var ss   = SpreadsheetApp.openById(SHEET_ID);
  var rows = [];

  SHEET_NAMES.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      Logger.log('Aba não encontrada: "' + name + '" — ignorada.');
      return;
    }
    var sheetRows = readSheet(sheet, name);
    Logger.log('Aba "' + name + '": ' + sheetRows.length + ' linha(s) válida(s).');
    rows = rows.concat(sheetRows);
  });

  if (rows.length === 0) {
    Logger.log('Nenhum dado encontrado em nenhuma aba — sync cancelado.');
    return;
  }

  deleteAll();
  insertAll(rows);
  Logger.log('Sync concluído: ' + rows.length + ' linha(s) importada(s) no total.');
}

// ── Leitura de uma aba ───────────────────────────────────────
// Estrutura esperada (linha 1 = cabeçalho, ignorado):
// A=Data  B=Credor  C=Descrição  D=Tipo  E=Conta Bancária
// F=Valor  G=Status  H=Categoria  I=Centro de Custo

function readSheet(sheet, sheetName) {
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var vals = sheet.getRange(2, 1, last - 1, 9).getValues();
  var rows = [];

  vals.forEach(function(row, idx) {
    var dataRaw     = row[0];
    var credor      = String(row[1] || '').trim();
    var descricao   = String(row[2] || '').trim();
    var tipoOp      = String(row[3] || 'Débito').trim();
    var contaBanc   = String(row[4] || '').trim();
    var valorRaw    = row[5];
    var status      = String(row[6] || '').trim();
    var categoria   = String(row[7] || '').trim();
    var centroCusto = String(row[8] || '').trim();

    // Linha totalmente vazia — pular
    if (!dataRaw && !credor && !valorRaw) return;

    var dataStr = formatDate(dataRaw);
    if (!dataStr) {
      Logger.log('[' + sheetName + '] Linha ' + (idx + 2) + ': data inválida "' + dataRaw + '" — ignorada.');
      return;
    }

    var valor = parseValor(valorRaw);
    if (isNaN(valor)) {
      Logger.log('[' + sheetName + '] Linha ' + (idx + 2) + ': valor inválido "' + valorRaw + '" — ignorada.');
      return;
    }

    // Débito = negativo, Crédito = positivo
    if (tipoOp === 'Débito' || tipoOp === 'Debito') {
      valor = -Math.abs(valor);
    } else {
      valor = Math.abs(valor);
    }
    tipoOp = valor < 0 ? 'Débito' : 'Crédito';

    rows.push({
      data_movimento : dataStr,
      credor         : credor,
      descricao      : descricao,
      tipo_operacao  : tipoOp,
      conta_bancaria : contaBanc,
      valor          : valor,
      status         : status,
      categoria      : categoria,
      centro_custo   : centroCusto,
    });
  });

  return rows;
}

// ── Helpers de formatação ────────────────────────────────────

function formatDate(raw) {
  if (!raw) return null;

  if (raw instanceof Date) {
    var y = raw.getFullYear();
    var m = String(raw.getMonth() + 1).padStart(2, '0');
    var d = String(raw.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  var s = String(raw).trim();
  var match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return match[3] + '-' + match[2] + '-' + match[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseValor(raw) {
  if (typeof raw === 'number') return raw;
  var s = String(raw)
    .replace(/R\$\s*/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
    .trim();
  return parseFloat(s);
}

// ── DELETE all ───────────────────────────────────────────────

function deleteAll() {
  var url = SUPABASE_URL + '/rest/v1/' + TABLE + '?data_movimento=not.is.null';
  var resp = UrlFetchApp.fetch(url, {
    method             : 'DELETE',
    headers            : headers(),
    muteHttpExceptions : true,
  });
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Erro ao deletar: HTTP ' + code + ' — ' + resp.getContentText());
  }
  Logger.log('DELETE concluído (HTTP ' + code + ').');
}

// ── INSERT em lotes ──────────────────────────────────────────

function insertAll(rows) {
  var url = SUPABASE_URL + '/rest/v1/' + TABLE;
  for (var i = 0; i < rows.length; i += BATCH_SIZE) {
    var batch = rows.slice(i, i + BATCH_SIZE);
    var resp  = UrlFetchApp.fetch(url, {
      method             : 'POST',
      headers            : headers(),
      payload            : JSON.stringify(batch),
      contentType        : 'application/json',
      muteHttpExceptions : true,
    });
    var code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error('Erro ao inserir lote ' + (i / BATCH_SIZE + 1) + ': HTTP ' + code + ' — ' + resp.getContentText());
    }
    Logger.log('Lote ' + (i / BATCH_SIZE + 1) + ' inserido (' + batch.length + ' linhas).');
  }
}

// ── Headers padrão Supabase ──────────────────────────────────

function headers() {
  return {
    'apikey'        : SUPABASE_SERVICE_KEY,
    'Authorization' : 'Bearer ' + SUPABASE_SERVICE_KEY,
    'Content-Type'  : 'application/json',
    'Prefer'        : 'return=minimal',
  };
}
