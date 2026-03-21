export const localeDefinitions = Object.freeze([
  {
    code: 'en',
    nativeLabel: 'English',
    shortLabel: 'EN',
    aliases: ['en', 'en-us', 'en-gb'],
  },
  {
    code: 'zh-TW',
    nativeLabel: '繁體中文',
    shortLabel: '繁中',
    aliases: ['zh', 'zh-cn', 'zh-hans', 'zh-hant', 'zh-hk', 'zh-mo', 'zh-tw'],
  },
  {
    code: 'ja',
    nativeLabel: '日本語',
    shortLabel: '日本語',
    aliases: ['ja', 'ja-jp'],
  },
]);

export const localeDefinitionMap = Object.freeze(
  Object.fromEntries(localeDefinitions.map((definition) => [definition.code, definition]))
);

export const localeAliasMap = Object.freeze(
  localeDefinitions.reduce((result, definition) => {
    const aliases = Array.isArray(definition.aliases) ? definition.aliases : [];

    aliases.forEach((alias) => {
      result[String(alias).trim().toLowerCase()] = definition.code;
    });

    result[String(definition.code).trim().toLowerCase()] = definition.code;
    return result;
  }, {})
);

export function getLocaleDefinition(code) {
  return localeDefinitionMap[code] || null;
}
