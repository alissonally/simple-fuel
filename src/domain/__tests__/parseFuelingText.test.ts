import { parseFuelingText } from '../parseFuelingText';

const TODAY = '2026-11-07';
const parse = (text: string) => parseFuelingText(text, TODAY);

describe('parseFuelingText', () => {
  it('reads the full example sentence', () => {
    expect(
      parse(
        'Crie um abastencimento no valor de R$ 200 feito em 05 de novembro de 2026. ' +
          'Odomentro ou km 85500, valor do litro R$ 6,65',
      ),
    ).toEqual({
      date: '2026-11-05',
      odometerKm: 85500,
      pricePerLiterMilli: 6650,
      totalCents: 20000,
    });
  });

  it('returns nothing for unrelated text', () => {
    expect(parse('')).toEqual({});
    expect(parse('bom dia')).toEqual({});
  });

  describe('money', () => {
    it.each([
      ['paguei R$ 200,50', 20050],
      ['R$200', 20000],
      ['valor total 1.234,56', 123456],
      ['deu 150 reais', 15000],
      ['gastei 89,9', 8990],
    ])('%p -> total %p cents', (text, cents) => {
      expect(parse(text).totalCents).toBe(cents);
    });

    it.each([
      ['litro a 5,899', 5899],
      ['preço do litro R$ 6,65', 6650],
      ['6,49 o litro', 6490],
      ['R$ 6,19 por litro', 6190],
      ['litro a 6.65', 6650],
      ['litro a 6.650', 6650],
      ['litro a 6 reais e 5 centavos', 6050],
      ['preço 5,8999', 5900],
    ])('%p -> price %p milli', (text, milli) => {
      expect(parse(text).pricePerLiterMilli).toBe(milli);
    });

    it('does not mix up price and total in the same sentence', () => {
      expect(parse('litro a 6,65 e total de R$ 200')).toMatchObject({
        pricePerLiterMilli: 6650,
        totalCents: 20000,
      });
      expect(parse('200 reais, 6,65 o litro')).toMatchObject({
        pricePerLiterMilli: 6650,
        totalCents: 20000,
      });
    });
  });

  describe('odometer', () => {
    it.each([
      ['odômetro 85.500', 85500],
      ['hodômetro marcando 45230', 45230],
      ['85500 km', 85500],
      ['quilometragem 85 mil e 500', 85500],
      ['painel em 120 mil', 120000],
      ['km 9.876', 9876],
    ])('%p -> %p km', (text, km) => {
      expect(parse(text).odometerKm).toBe(km);
    });
  });

  it('guesses numbers without context', () => {
    expect(parse('85500 200 6,65')).toEqual({
      odometerKm: 85500,
      totalCents: 20000,
      pricePerLiterMilli: 6650,
    });
  });

  it('derives the missing price or total from liters', () => {
    expect(parse('R$ 200 e 30 litros').pricePerLiterMilli).toBe(6667);
    expect(parse('40 litros a 5,50 o litro').totalCents).toBe(22000);
    expect(parse('40 litros')).toEqual({});
  });

  it('drops zero values', () => {
    expect(parse('odômetro 0, R$ 0')).toEqual({});
  });

  describe('dates', () => {
    it.each([
      ['hoje', '2026-11-07'],
      ['ontem', '2026-11-06'],
      ['anteontem', '2026-11-05'],
      ['antes de ontem', '2026-11-05'],
      ['em 05/11/2026', '2026-11-05'],
      ['em 3/10/26', '2026-10-03'],
      ['em 03-10', '2026-10-03'],
      ['20/12', '2025-12-20'],
      ['05 de novembro de 2026', '2026-11-05'],
      ['1º de outubro', '2026-10-01'],
      ['primeiro de outubro', '2026-10-01'],
      ['dia 3 de março', '2026-03-03'],
      ['15 dez', '2025-12-15'],
      ['dia 5', '2026-11-05'],
      ['dia 30', '2026-10-30'],
    ])('%p -> %p', (text, date) => {
      expect(parse(text).date).toBe(date);
    });

    it('wraps "dia N" into the previous year in January', () => {
      expect(parseFuelingText('dia 20', '2027-01-05').date).toBe('2026-12-20');
    });

    it('ignores impossible dates', () => {
      expect(parse('31/02/2026').date).toBeUndefined();
      expect(parse('dia 31 de novembro').date).toBeUndefined();
    });

    it('does not read the date as a value', () => {
      expect(parse('dia 05/11/2026 R$ 200')).toEqual({ date: '2026-11-05', totalCents: 20000 });
      expect(parse('5 de novembro de 2026')).toEqual({ date: '2026-11-05' });
    });
  });

  describe('fuel, tank and station', () => {
    it.each([
      ['gasolina aditivada', 'gasoline'],
      ['Etanol', 'ethanol'],
      ['álcool', 'ethanol'],
      ['diesel S10', 'diesel'],
      ['GNV', 'cng'],
      ['gás natural', 'cng'],
    ] as const)('%p -> %p', (text, fuel) => {
      expect(parse(text).fuelType).toBe(fuel);
    });

    it('does not take "posto de gasolina" as the fuel', () => {
      expect(parse('no posto de gasolina Ipiranga, etanol').fuelType).toBe('ethanol');
      expect(parse('no posto de gasolina').fuelType).toBeUndefined();
    });

    it.each([
      ['tanque cheio', true],
      ['completei', true],
      ['parcial', false],
      ['não completei o tanque', false],
      ['meio tanque', false],
    ])('%p -> fullTank %p', (text, full) => {
      expect(parse(text).fullTank).toBe(full);
    });

    it('keeps the station name as typed', () => {
      expect(parse('no posto Shell da Avenida, R$ 200').station).toBe('Shell da Avenida');
      expect(parse('posto São Jorge dia 5').station).toBe('São Jorge');
      expect(parse('posto de gasolina Ipiranga').station).toBe('Ipiranga');
      expect(parse('posto, R$ 200').station).toBeUndefined();
    });
  });
});
