import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrarVentaComponent } from './registrar-venta.component';

describe('RegistrarVentaComponent', () => {
  let component: RegistrarVentaComponent;
  let fixture: ComponentFixture<RegistrarVentaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarVentaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrarVentaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
