export type StorageType = 'local' | 'session';

export type StorageSchema = Record<string, any>;
export type SchemaKeys<T extends StorageSchema> = keyof T & string;

export type StorageProps<
  TSchema extends StorageSchema,
  TKey extends SchemaKeys<TSchema>
> = {
  key: TKey;
  initialValue: TSchema[TKey];
};

export type SignalStoreEntry<T> = {
  value: () => T;
  setValue: (value: T) => void;
  subscribers: number;
};
