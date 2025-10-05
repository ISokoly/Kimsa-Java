import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CaracteristicasProductoComponent } from './caracteristicas-producto.component';

describe('CaracteristicasProductoComponent', () => {
  let component: CaracteristicasProductoComponent;
  let fixture: ComponentFixture<CaracteristicasProductoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaracteristicasProductoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CaracteristicasProductoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
