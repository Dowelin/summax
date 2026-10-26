import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ATTEMPTS, SESSION_LENGTH, Session, memoryLevels } from '../src/session.ts';
import { classify } from '../src/tasks/classify.ts';
import { templateById } from '../src/tasks/registry.ts';
import { grade } from '../src/core/grade.ts';
import { Q } from '../src/core/rational.ts';
import { UNITS } from '../src/core/units.ts';

const write = (q: Q): string => (q.isInteger() ? q.n.toString() : q.toFractionString());

function answerWith(s: Session, value: Q): string {
  const a = s.current!.task.answer;
  return write(value) + (a.type === 'quantity' ? ` ${UNITS[a.unit].label}` : '');
}
const right = (s: Session): string => answerWith(s, s.current!.task.answer.value);
/** Ett fel svar som inte matchar något felmönster: facit · 2 + 1. */
const wrong = (s: Session): string => answerWith(s, s.current!.task.answer.value.mul(Q.int(2)).add(Q.ONE));

describe('träningspass', () => {
  it('två säkra svar i rad höjer nivån', () => {
    const levels = memoryLevels({ brak: 2 });
    const s = new Session('brak', levels, 1);
    s.next();
    assert.equal(s.submit(right(s)).outcome, 'strong');
    s.next();
    s.submit(right(s));
    assert.equal(levels.get('brak'), 3);
  });

  it('två olösta uppgifter i rad sänker nivån, en enstaka gör det inte', () => {
    const levels = memoryLevels({ procent: 3 });
    const s = new Session('procent', levels, 2);
    s.next();
    for (let i = 0; i < MAX_ATTEMPTS; i++) s.submit(wrong(s));
    assert.equal(s.current!.outcome, 'not-solved');
    assert.equal(levels.get('procent'), 3);
    s.next();
    for (let i = 0; i < MAX_ATTEMPTS; i++) s.submit(wrong(s));
    assert.equal(levels.get('procent'), 2);
  });

  it('rätt efter ledtråd räknas som löst med hjälp', () => {
    const s = new Session('ekvationer', memoryLevels(), 3);
    s.next();
    s.showHint();
    assert.equal(s.submit(right(s)).outcome, 'with-help');
  });

  it('ledtråd 4 visar lösningen och avslutar uppgiften', () => {
    const s = new Session('geometri', memoryLevels(), 4);
    s.next();
    for (let i = 0; i < 4; i++) s.showHint();
    assert.equal(s.current!.outcome, 'not-solved');
  });

  it('oläsliga svar räknas inte som försök', () => {
    const s = new Session('brak', memoryLevels(), 5);
    s.next();
    for (let i = 0; i < 5; i++) assert.equal(s.submit('hmm?').done, false);
    assert.equal(s.current!.attempts.length, 0);
  });

  it('blandat pass tar inte samma område tre gånger i rad', () => {
    const s = new Session('blandat', memoryLevels(), 6);
    const areas: string[] = [];
    for (let i = 0; i < SESSION_LENGTH; i++) {
      s.next();
      areas.push(s.current!.task.area);
      s.submit(right(s));
    }
    for (let i = 2; i < areas.length; i++) {
      assert.ok(!(areas[i] === areas[i - 1] && areas[i] === areas[i - 2]), areas.join(','));
    }
    assert.equal(s.finished, true);
  });
});

describe('klassning av fel', () => {
  const task = templateById('A2.2-2-tva-steg')!.instantiate(7);
  const x = task.answer.value;

  it('fel tecken blir troligt slarvfel', () => {
    assert.equal(classify(task, grade(task.answer, write(x.neg()))).kind, 'careless');
  });

  it('fel tiopotens blir troligt slarvfel', () => {
    assert.equal(classify(task, grade(task.answer, write(x.mul(Q.int(10))))).kind, 'careless');
  });

  it('ett helt annat svar blir okänt', () => {
    assert.equal(classify(task, grade(task.answer, write(x.mul(Q.int(7)).add(Q.of(1, 3))))).kind, 'unknown');
  });

  it('fel slags enhet blir enhetsfel', () => {
    const area = templateById('G2.1-1-rektangelns-area')!.instantiate(11);
    assert.equal(classify(area, grade(area.answer, `${write(area.answer.value)} cm`)).kind, 'unit');
  });
});
