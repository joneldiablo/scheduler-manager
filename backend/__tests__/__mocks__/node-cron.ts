import { jest } from '@jest/globals';

const nodeCron = {
  schedule: jest.fn().mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
  }),
  validate: jest.fn().mockReturnValue(true),
};

export default nodeCron;
export const schedule = nodeCron.schedule;
export const validate = nodeCron.validate;
