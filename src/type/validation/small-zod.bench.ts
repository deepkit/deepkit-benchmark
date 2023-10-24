/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { z as t } from 'zod';
import { BenchSuite } from '../../bench';
import { good } from "./validation";

const type = t.object({
    number: t.number(),
    negNumber: t.number().negative(),
    maxNumber: t.number().max(500),
    strings: t.array(t.string()),
    longString: t.string(),
    boolean: t.boolean(),
    deeplyNested: t.object({
        foo: t.string(),
        num: t.number(),
        bool: t.boolean()
    })
})

export async function main() {
    const suite = new BenchSuite('zod');

    type.parse(good);

    suite.add('validate', () => {
        type.safeParse(good);
    });
    suite.run();
}
