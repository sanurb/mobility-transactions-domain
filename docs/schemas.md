# Cat Management API - Schema Documentation

## CatListResponse

_Object containing the following properties:_

| Property              | Type                                                                                                                                                                                                                               |
| :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`cats`** (\*)       | _Array of [Cat](#cat) items_                                                                                                                                                                                                       |
| **`pagination`** (\*) | _Object with properties:_<ul><li>**`page`** (\*): `number` (_int, >0_)</li><li>**`limit`** (\*): `number` (_int, >0_)</li><li>**`total`** (\*): `number` (_int, ≥0_)</li><li>**`totalPages`** (\*): `number` (_int, ≥0_)</li></ul> |

_(\*) Required._

## CatParams

_Object containing the following properties:_

| Property      | Type              |
| :------------ | :---------------- |
| **`id`** (\*) | `string` (_uuid_) |

_(\*) Required._

## CatQuery

_Object containing the following properties:_

| Property         | Type     |
| :--------------- | :------- |
| **`page`** (\*)  | `string` |
| **`limit`** (\*) | `string` |
| `breed`          | `string` |
| `isAdopted`      | `string` |

_(\*) Required._

## Cat

_Object containing the following properties:_

| Property         | Type                                       | Default                      |
| :--------------- | :----------------------------------------- | :--------------------------- |
| **`id`** (\*)    | `string` (_uuid_)                          |                              |
| **`name`** (\*)  | `string` (_min length: 1, max length: 50_) |                              |
| **`age`** (\*)   | `number` (_int, ≥0, ≤30_)                  |                              |
| **`breed`** (\*) | `string` (_min length: 1, max length: 30_) |                              |
| **`color`** (\*) | `string` (_min length: 1, max length: 20_) |                              |
| `isAdopted`      | `boolean`                                  | `false`                      |
| `createdAt`      | `Date`                                     | `"2025-10-22T04:10:31.700Z"` |
| `updatedAt`      | `Date`                                     | `"2025-10-22T04:10:31.700Z"` |

_(\*) Required._

## CreateCat

_Object containing the following properties:_

| Property         | Type                                       | Default |
| :--------------- | :----------------------------------------- | :------ |
| **`name`** (\*)  | `string` (_min length: 1, max length: 50_) |         |
| **`age`** (\*)   | `number` (_int, ≥0, ≤30_)                  |         |
| **`breed`** (\*) | `string` (_min length: 1, max length: 30_) |         |
| **`color`** (\*) | `string` (_min length: 1, max length: 20_) |         |
| `isAdopted`      | `boolean`                                  | `false` |

_(\*) Required._

## UpdateCat

_Object containing the following properties:_

| Property      | Type                                       | Default                      |
| :------------ | :----------------------------------------- | :--------------------------- |
| **`id`** (\*) | `string` (_uuid_)                          |                              |
| `name`        | `string` (_min length: 1, max length: 50_) |                              |
| `age`         | `number` (_int, ≥0, ≤30_)                  |                              |
| `breed`       | `string` (_min length: 1, max length: 30_) |                              |
| `color`       | `string` (_min length: 1, max length: 20_) |                              |
| `isAdopted`   | `boolean`                                  | `false`                      |
| `createdAt`   | `Date`                                     | `"2025-10-22T04:10:31.700Z"` |
| `updatedAt`   | `Date`                                     | `"2025-10-22T04:10:31.700Z"` |

_(\*) Required._
