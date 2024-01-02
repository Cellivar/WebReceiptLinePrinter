import * as Cmds from "./index.js";
import type { CommandSet, TranspiledDocumentState } from "./CommandSet.js";
import { TranspileDocumentError } from "./TranspileCommandError.js";

type PrecompiledTransaction = {
  commands: Array<Cmds.IPrinterCommand>;
  waitCommand?: Cmds.IPrinterCommand;
};

export function transpileDocument<TOutput>(
  doc: Cmds.IDocument,
  commandSet: CommandSet<TOutput>,
  documentMetadata: TranspiledDocumentState,
): Readonly<Cmds.CompiledDocument<TOutput>> {

  const cmdsWithinDoc = [
    ...commandSet.documentStartCommands,
    ...doc.commands,
    ...commandSet.documentEndCommands,
  ];
  const { transactions, effects } = splitTransactions(cmdsWithinDoc, commandSet);

  const commandsWithMaybeErrors = transactions
    .map((trans) => compileTransaction(trans, commandSet, documentMetadata));

  const errs = commandsWithMaybeErrors.flatMap(ce => ce.errors);
  if (errs.length > 0) {
    throw new TranspileDocumentError(
      'One or more validation errors occurred transpiling the document.',
      errs
    );
  }

  return Object.freeze(
    new Cmds.CompiledDocument(
      commandSet.commandLanguage,
      effects,
      commandsWithMaybeErrors.map(c => c.transaction)
    )
  );
}

function compileTransaction<TOutput>(
  trans: PrecompiledTransaction,
  commandSet: CommandSet<TOutput>,
  docState: TranspiledDocumentState,
): {
  transaction: Cmds.Transaction<TOutput>,
  errors: TranspileDocumentError[]
} {
  const {cmds, errors} = trans.commands
    .map((cmd) => commandSet.transpileCommand(cmd, docState))
    .reduce((a, cmd) => {
      if (cmd instanceof TranspileDocumentError) {
        a.errors.push(cmd);
      } else {
        a.cmds.push(cmd);
      }
      return a;
    }, {
      cmds: new Array<TOutput>,
      errors: new Array<TranspileDocumentError>,
    });

  return {
    transaction: new Cmds.Transaction<TOutput>(
      commandSet.combineCommands(...cmds),
      trans.waitCommand
    ),
    errors
  };
}

function splitTransactions<TOutput>(
  commands: ReadonlyArray<Cmds.IPrinterCommand>,
  commandSet: CommandSet<TOutput>,
): {
  transactions: PrecompiledTransaction[];
  effects: Cmds.CommandEffectFlags
} {
  const effects = new Cmds.CommandEffectFlags();
  const transactions: PrecompiledTransaction[] = [{ commands: [] }];
  let currentTrans: Cmds.IPrinterCommand[] = [];

  // We may need to add new commands while iterating, create a stack.
  let commandStack = commands.toReversed();

  do {
    const command = commandStack.pop();
    if (command === undefined) { continue; }

    // Determine if this command needs to be substituted for others.
    const yetMoreCommands = commandSet.expandCommand(command);
    if (yetMoreCommands.length > 0) {
      // The command set gave us fun new commands to deal with instead of the
      // current one. Add those to the stack and drop the current one.
      yetMoreCommands.map(c => commandStack.push(c));
      continue;
    }

    // Record the command in the transpile buffer.
    transactions.at(-1)?.commands.push(command);
    command.effectFlags.forEach(effects.add);

    if (command.effectFlags.has("waitsForResponse")) {
      // This command expects the printer to provide feedback. We should pause
      // sending more commands until we get its response, which could take some
      // amount of time.
      // This is the end of our transaction.
      transactions.push({
        commands: currentTrans,
        waitCommand: command,
      });
      currentTrans = [];
    }
  } while (commandStack.length > 0)

  if (currentTrans.length > 0) {
    currentTrans.push();
    transactions.push({ commands: currentTrans });
  }

  return { transactions, effects }
}
