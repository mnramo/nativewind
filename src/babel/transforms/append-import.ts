import {
  identifier,
  importDeclaration,
  importSpecifier,
  Statement,
  stringLiteral,
} from "@babel/types";

export function prependImport(
  body: Statement[],
  variable: string | string[],
  source: string
) {
  body.unshift(
    importDeclaration(
      typeof variable === "string"
        ? [importSpecifier(identifier(variable), identifier(variable))]
        : [importSpecifier(identifier(variable[0]), identifier(variable[1]))],
      stringLiteral(source)
    )
  );
}

export function prependImports(
  body: Statement[],
  variables: Array<string | string[]>,
  source: string
) {
  body.unshift(
    importDeclaration(
      variables.map((variable) => {
        return typeof variable === "string"
          ? importSpecifier(identifier(variable), identifier(variable))
          : importSpecifier(identifier(variable[0]), identifier(variable[1]));
      }),
      stringLiteral(source)
    )
  );
}
